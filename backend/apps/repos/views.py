import requests
from django.conf import settings
from django.http import JsonResponse, StreamingHttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from apps.repos.models import Repo, Commit, User
from ingestion.tasks import ingest_repo
import google.generativeai as genai


def _get_user(request) -> User:
    """Helper — DRF sets request.user to the JWT subject (user id stored as pk)."""
    return request.user


# ── /repos/available ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def repos_available(request):
    user = _get_user(request)
    if not user.access_token:
        return Response({'error': 'GitHub access token not found'}, status=400)

    res = requests.get(
        'https://api.github.com/user/repos?sort=updated&per_page=100',
        headers={
            'Authorization': f'Bearer {user.access_token}',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitLore-App',
        },
    )
    if not res.ok:
        return Response({'error': 'Failed to fetch repositories from GitHub'}, status=500)

    repos = res.json()
    return Response([{
        'githubRepoId': str(r['id']),
        'name': r['name'],
        'fullName': r['full_name'],
        'private': r['private'],
        'language': r.get('language'),
        'stargazersCount': r['stargazers_count'],
        'defaultBranch': r['default_branch'],
    } for r in repos])


# ── /repos/connected ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def repos_connected(request):
    user = _get_user(request)
    repos = Repo.objects.filter(user=user).order_by('-created_at').values(
        'id', 'github_repo_id', 'full_name', 'default_branch',
        'ingestion_status', 'ingestion_progress', 'created_at',
    )
    # Rename snake_case to camelCase to match frontend
    result = []
    for r in repos:
        result.append({
            'id': r['id'],
            'githubRepoId': r['github_repo_id'],
            'fullName': r['full_name'],
            'defaultBranch': r['default_branch'],
            'ingestionStatus': r['ingestion_status'],
            'ingestionProgress': r['ingestion_progress'],
            'createdAt': r['created_at'],
        })
    return Response(result)


# ── /repos/connect ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def repos_connect(request):
    user = _get_user(request)
    data = request.data
    github_repo_id = data.get('githubRepoId')
    full_name = data.get('fullName')
    default_branch = data.get('defaultBranch')

    repo, created = Repo.objects.update_or_create(
        github_repo_id=github_repo_id,
        defaults={
            'user': user,
            'full_name': full_name,
            'default_branch': default_branch,
        },
    )

    if repo.ingestion_status == 'pending':
        # Kick off Celery task
        ingest_repo.delay(repo.id)

    return Response({
        'success': True,
        'repo': {
            'id': repo.id,
            'githubRepoId': repo.github_repo_id,
            'fullName': repo.full_name,
            'ingestionStatus': repo.ingestion_status,
        },
    })


# ── /repos/:repoId/status ─────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def repo_status(request, repo_id):
    try:
        repo = Repo.objects.prefetch_related('commits').get(id=repo_id)
    except Repo.DoesNotExist:
        return Response({'error': 'Repo not found'}, status=404)

    recent_commits = list(
        repo.commits.order_by('-timestamp')[:3].values('sha', 'message', 'author_name', 'timestamp')
    )
    # camelCase for frontend
    commits_out = [{
        'sha': c['sha'],
        'message': c['message'],
        'authorName': c['author_name'],
        'timestamp': c['timestamp'],
    } for c in recent_commits]

    return Response({
        'ingestionStatus': repo.ingestion_status,
        'ingestionProgress': repo.ingestion_progress,
        'fullName': repo.full_name,
        'commits': commits_out,
    })


# ── /commits/:sha ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def commit_detail(request, sha):
    repo_id = request.GET.get('repoId')
    try:
        commit = (
            Commit.objects
            .prefetch_related('files', 'prs__comments', 'ticket_refs')
            .get(sha=sha, repo_id=repo_id)
        )
    except Commit.DoesNotExist:
        return Response({'error': 'Commit not found'}, status=404)

    prs_data = []
    for pr in commit.prs.all():
        comments_data = [
            {'id': c.id, 'authorLogin': c.author_login, 'body': c.body, 'createdAt': c.created_at}
            for c in pr.comments.all()
        ]
        prs_data.append({
            'id': pr.id,
            'githubPrNumber': pr.github_pr_number,
            'title': pr.title,
            'body': pr.body,
            'state': pr.state,
            'mergedAt': pr.merged_at,
            'comments': comments_data,
        })

    files_data = [
        {'id': f.id, 'filePath': f.file_path, 'additions': f.additions, 'deletions': f.deletions, 'patch': f.patch}
        for f in commit.files.all()
    ]

    return Response({
        'id': commit.id,
        'sha': commit.sha,
        'message': commit.message,
        'authorName': commit.author_name,
        'authorEmail': commit.author_email,
        'timestamp': commit.timestamp,
        'prs': prs_data,
        'files': files_data,
    })


# ── /commits/:sha/explain ─────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def commit_explain(request, sha):
    repo_id = request.data.get('repoId')
    try:
        commit = (
            Commit.objects
            .prefetch_related('files', 'prs__comments')
            .get(sha=sha, repo_id=repo_id)
        )
    except Commit.DoesNotExist:
        return Response({'error': 'Commit not found'}, status=404)

    files_str = '\n'.join(f'- {f.file_path}' for f in commit.files.all())
    prs_str = '\n\n'.join(
        f'PR Title: {pr.title}\nBody: {pr.body or ""}' for pr in commit.prs.all()
    )

    prompt = (
        f"You are a senior developer reviewing a commit. Please explain this commit clearly and concisely.\n\n"
        f"Commit Message: {commit.message}\n"
        f"Author: {commit.author_name}\n\n"
        f"Files Changed:\n{files_str}\n\n"
        f"Pull Requests Context:\n{prs_str}"
    )

    def stream_gemini():
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content(prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f'\n\n[Error generating explanation: {e}]'

    return StreamingHttpResponse(
        stream_gemini(),
        content_type='text/plain; charset=utf-8',
    )
