import requests
from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse
from django.views import View
from rest_framework_simplejwt.tokens import RefreshToken
from apps.repos.models import User


class GitHubConnectView(View):
    """Redirect user to GitHub OAuth page."""

    def get(self, request):
        from urllib.parse import urlencode
        params = urlencode({
            'client_id': settings.GITHUB_CLIENT_ID,
            'scope': 'read:user user:email repo',
            'redirect_uri': 'http://localhost:8080/auth/github/callback',
        })
        return HttpResponseRedirect(f'https://github.com/login/oauth/authorize?{params}')


class GitHubCallbackView(View):
    """Handle GitHub OAuth callback: exchange code → upsert user → set JWT cookie."""

    def get(self, request):
        code = request.GET.get('code')
        if not code:
            return JsonResponse({'error': 'Missing code'}, status=400)

        # Exchange code for access token
        token_res = requests.post(
            'https://github.com/login/oauth/access_token',
            headers={'Accept': 'application/json'},
            json={
                'client_id': settings.GITHUB_CLIENT_ID,
                'client_secret': settings.GITHUB_CLIENT_SECRET,
                'code': code,
            },
        )
        token_data = token_res.json()
        access_token = token_data.get('access_token')
        if not access_token:
            return JsonResponse({'error': 'GitHub token exchange failed'}, status=500)

        # Fetch GitHub user
        gh_headers = {
            'Authorization': f'Bearer {access_token}',
            'User-Agent': 'GitLore-App',
        }
        user_res = requests.get('https://api.github.com/user', headers=gh_headers)
        github_user = user_res.json()

        # Get primary email
        email = github_user.get('email')
        if not email:
            emails_res = requests.get('https://api.github.com/user/emails', headers=gh_headers)
            emails = emails_res.json()
            primary = next((e for e in emails if e.get('primary')), None)
            email = primary['email'] if primary else emails[0]['email']

        # Encrypt access token
        from cryptography.fernet import Fernet
        f = Fernet(settings.FERNET_KEY.encode())
        encrypted_token = f.encrypt(access_token.encode()).decode()

        # Upsert user
        user, _ = User.objects.update_or_create(
            github_id=str(github_user['id']),
            defaults={
                'email': email,
                'name': github_user.get('name') or github_user.get('login'),
                'avatar_url': github_user.get('avatar_url'),
                'access_token': encrypted_token,
            },
        )

        # Issue JWT
        refresh = RefreshToken.for_user(user)
        # Add custom claims to match frontend expectations
        refresh['id'] = user.id
        refresh['email'] = user.email
        jwt_token = str(refresh.access_token)

        response = HttpResponseRedirect(f"{settings.FRONTEND_URL}/dashboard")
        response.set_cookie(
            'gitlore_token',
            jwt_token,
            max_age=60 * 60 * 24 * 7,
            httponly=True,
            samesite='Lax',
            secure=not settings.DEBUG,
        )
        return response
