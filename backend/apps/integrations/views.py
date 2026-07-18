import base64
import json
import requests
from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse
from django.views import View
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.repos.models import Integration, Repo, Ticket, TicketRef
from lib.neo4j_client import get_driver


# ── Helpers ───────────────────────────────────────────────────────────────────

def _adf_to_text(node) -> str:
    """Recursively extract plain text from Jira ADF."""
    if not node:
        return ''
    if node.get('type') == 'text':
        return node.get('text', '')
    children = node.get('content', [])
    if children:
        return ' '.join(_adf_to_text(child) for child in children)
    return ''


def _sync_ticket_neo4j(ticket: Ticket):
    driver = get_driver()
    with driver.session() as session:
        session.execute_write(
            lambda tx: tx.run(
                """
                MERGE (t:Ticket {repoId: $repoId, externalId: $externalId, source: $source})
                SET t.title = $title,
                    t.description = $description,
                    t.status = $status,
                    t.assignee = $assignee,
                    t.url = $url
                """,
                repoId=ticket.repo_id,
                externalId=ticket.external_id,
                source=ticket.source,
                title=ticket.title,
                description=ticket.description or '',
                status=ticket.status or '',
                assignee=ticket.assignee or '',
                url=ticket.url or '',
            )
        )


def _sync_jira_tickets(repo_id: str, integration: Integration):
    refs = TicketRef.objects.filter(commit__repo_id=repo_id, source='JIRA')
    unique_ids = list({r.external_id for r in refs})
    print(f'[Jira Sync] {len(unique_ids)} unique tickets')

    for issue_key in unique_ids:
        try:
            res = requests.get(
                f'https://api.atlassian.com/ex/jira/{integration.cloud_id}/rest/api/3/issue/{issue_key}',
                headers={
                    'Authorization': f'Bearer {integration.access_token}',
                    'Accept': 'application/json',
                },
            )
            if not res.ok:
                print(f'[Jira Sync] Failed {issue_key}: {res.status_code}')
                continue
            data = res.json()
            fields = data['fields']
            ticket, _ = Ticket.objects.update_or_create(
                repo_id=repo_id, external_id=issue_key, source='JIRA',
                defaults={
                    'title': fields['summary'],
                    'description': _adf_to_text(fields.get('description')),
                    'status': fields.get('status', {}).get('name'),
                    'assignee': (fields.get('assignee') or {}).get('displayName'),
                    'reporter': (fields.get('reporter') or {}).get('displayName'),
                    'url': f"{integration.site_url}/browse/{issue_key}",
                },
            )
            _sync_ticket_neo4j(ticket)
            print(f'[Jira Sync] Synced {issue_key}')
        except Exception as e:
            print(f'[Jira Sync] Error on {issue_key}: {e}')


def _sync_linear_tickets(repo_id: str, integration: Integration):
    refs = TicketRef.objects.filter(commit__repo_id=repo_id, source='LINEAR')
    unique_ids = list({r.external_id for r in refs})
    print(f'[Linear Sync] {len(unique_ids)} unique tickets')

    for issue_id in unique_ids:
        try:
            query = f"""
                query {{
                    issue(id: "{issue_id}") {{
                        id title description
                        state {{ name }}
                        assignee {{ name }}
                        creator {{ name }}
                        url
                    }}
                }}
            """
            res = requests.post(
                'https://api.linear.app/graphql',
                headers={
                    'Authorization': f'Bearer {integration.access_token}',
                    'Content-Type': 'application/json',
                },
                json={'query': query},
            )
            if not res.ok:
                print(f'[Linear Sync] Failed {issue_id}: {res.status_code}')
                continue
            issue = res.json().get('data', {}).get('issue')
            if not issue:
                continue
            ticket, _ = Ticket.objects.update_or_create(
                repo_id=repo_id, external_id=issue_id, source='LINEAR',
                defaults={
                    'title': issue['title'],
                    'description': issue.get('description'),
                    'status': (issue.get('state') or {}).get('name'),
                    'assignee': (issue.get('assignee') or {}).get('name'),
                    'reporter': (issue.get('creator') or {}).get('name'),
                    'url': issue.get('url'),
                },
            )
            _sync_ticket_neo4j(ticket)
            print(f'[Linear Sync] Synced {issue_id}')
        except Exception as e:
            print(f'[Linear Sync] Error on {issue_id}: {e}')


# ── Jira Connect ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def jira_connect(request):
    repo_id = request.GET.get('repoId')
    if not repo_id:
        return Response({'error': 'repoId is required'}, status=400)

    state = base64.b64encode(json.dumps({'repoId': repo_id, 'userId': request.user.id}).encode()).decode()
    from urllib.parse import urlencode
    params = urlencode({
        'audience': 'api.atlassian.com',
        'client_id': settings.JIRA_CLIENT_ID,
        'scope': 'read:jira-work read:jira-user offline_access',
        'redirect_uri': settings.JIRA_REDIRECT_URI,
        'state': state,
        'response_type': 'code',
        'prompt': 'consent',
    })
    return Response({'url': f'https://auth.atlassian.com/authorize?{params}'})


class JiraCallbackView(View):
    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')
        if not code or not state:
            return JsonResponse({'error': 'Missing code or state'}, status=400)

        decoded = json.loads(base64.b64decode(state).decode())
        repo_id = decoded['repoId']
        user_id = decoded['userId']

        # Exchange code for tokens
        token_res = requests.post(
            'https://auth.atlassian.com/oauth/token',
            json={
                'grant_type': 'authorization_code',
                'client_id': settings.JIRA_CLIENT_ID,
                'client_secret': settings.JIRA_CLIENT_SECRET,
                'code': code,
                'redirect_uri': settings.JIRA_REDIRECT_URI,
            },
        )
        if not token_res.ok:
            return JsonResponse({'error': 'Jira token exchange failed'}, status=500)

        tokens = token_res.json()
        access_token = tokens['access_token']
        refresh_token = tokens.get('refresh_token')

        # Get cloud ID
        sites_res = requests.get(
            'https://api.atlassian.com/oauth/token/accessible-resources',
            headers={'Authorization': f'Bearer {access_token}'},
        )
        sites = sites_res.json()
        if not sites:
            return JsonResponse({'error': 'No Atlassian sites found'}, status=400)

        cloud_id = sites[0]['id']
        site_url = sites[0]['url']

        from apps.repos.models import User
        user = User.objects.get(id=user_id)
        repo = Repo.objects.get(id=repo_id)

        integration, _ = Integration.objects.update_or_create(
            user=user, repo=repo, provider='JIRA',
            defaults={
                'access_token': access_token,
                'refresh_token': refresh_token,
                'cloud_id': cloud_id,
                'site_url': site_url,
            },
        )

        # Background sync
        import threading
        threading.Thread(target=_sync_jira_tickets, args=(repo_id, integration), daemon=True).start()

        return HttpResponseRedirect(f'{settings.FRONTEND_URL}/repo/{repo_id}/settings')


# ── Linear Connect ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def linear_connect(request):
    repo_id = request.GET.get('repoId')
    if not repo_id:
        return Response({'error': 'repoId is required'}, status=400)

    state = base64.b64encode(json.dumps({'repoId': repo_id, 'userId': request.user.id}).encode()).decode()
    from urllib.parse import urlencode
    params = urlencode({
        'client_id': settings.LINEAR_CLIENT_ID,
        'redirect_uri': settings.LINEAR_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'read',
        'state': state,
    })
    return Response({'url': f'https://linear.app/oauth/authorize?{params}'})


class LinearCallbackView(View):
    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')
        if not code or not state:
            return JsonResponse({'error': 'Missing code or state'}, status=400)

        decoded = json.loads(base64.b64decode(state).decode())
        repo_id = decoded['repoId']
        user_id = decoded['userId']

        token_res = requests.post(
            'https://api.linear.app/oauth/token',
            data={
                'client_id': settings.LINEAR_CLIENT_ID,
                'client_secret': settings.LINEAR_CLIENT_SECRET,
                'redirect_uri': settings.LINEAR_REDIRECT_URI,
                'code': code,
                'grant_type': 'authorization_code',
            },
        )
        if not token_res.ok:
            return JsonResponse({'error': 'Linear token exchange failed'}, status=500)

        access_token = token_res.json()['access_token']

        from apps.repos.models import User
        user = User.objects.get(id=user_id)
        repo = Repo.objects.get(id=repo_id)

        integration, _ = Integration.objects.update_or_create(
            user=user, repo=repo, provider='LINEAR',
            defaults={'access_token': access_token},
        )

        import threading
        threading.Thread(target=_sync_linear_tickets, args=(repo_id, integration), daemon=True).start()

        return HttpResponseRedirect(f'{settings.FRONTEND_URL}/repo/{repo_id}/settings')


# ── Status endpoints ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def integrations_status(request, repo_id):
    integrations = Integration.objects.filter(repo_id=repo_id, user=request.user).values(
        'provider', 'created_at', 'site_url'
    )
    return Response([{
        'provider': i['provider'],
        'createdAt': i['created_at'],
        'siteUrl': i['site_url'],
    } for i in integrations])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tickets_count(request, repo_id):
    from django.db.models import Count
    counts = Ticket.objects.filter(repo_id=repo_id).values('source').annotate(count=Count('id'))
    return Response([{'source': c['source'], 'count': c['count']} for c in counts])
