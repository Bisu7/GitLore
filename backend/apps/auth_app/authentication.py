from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from apps.repos.models import User


class CookieJWTAuthentication(JWTAuthentication):
    """Read JWT from the gitlore_token cookie. Uses our custom User model."""

    def authenticate(self, request):
        token = request.COOKIES.get('gitlore_token')
        if not token:
            return None
        try:
            validated_token = self.get_validated_token(token)
            user_id = validated_token.get('id')
            if not user_id:
                return None
            user = User.objects.get(id=user_id)
            return (user, validated_token)
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None
