import json
import time
from django.db import connection
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.repos.models import Repo, Commit, EmbeddingChunk, QueryLog
from lib.embedding import embed_text
from lib.plan_limits import check_query_limit, record_usage
from lib.cache import make_key, get_cached, set_cached

# ── /search ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def search(request):
    repo_id = request.data.get('repoId')
    query = request.data.get('query')
    limit = int(request.data.get('limit', 10))

    if not repo_id or not query:
        return Response({'error': 'Missing repoId or query'}, status=400)

    # Check repo existence and demo status
    repo = Repo.objects.filter(id=repo_id).first()
    if not repo:
        return Response({'error': 'Repo not found'}, status=404)

    user = getattr(request, 'user', None)

    # Demo repo allows public access without authentication
    if not repo.is_demo:
        if not user or not user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=401)
        if repo.user_id != user.id:
            return Response({'error': 'Unauthorized'}, status=403)

        # Enforce query limits for FREE tier (HTTP 402)
        allowed, limit_error = check_query_limit(user, repo)
        if not allowed:
            return Response(limit_error, status=402)

        # Record usage
        record_usage(user, repo, 'QUERY')

    # Check Redis cache for /search results (TTL: 15 minutes = 900 seconds)
    cache_key = make_key('search', repo_id, f"{query}:{limit}")
    cached_data = get_cached(cache_key)
    if cached_data is not None:
        return Response({'results': cached_data, 'cached': True})

    # Embed query using OpenAI
    import openai
    from django.conf import settings
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.embeddings.create(model="text-embedding-3-large", input=[query])
    vector = response.data[0].embedding

    vector_str = '[' + ','.join(str(v) for v in vector) + ']'

    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT ec."id", ec."commitId", ec."content", ec."metadata",
                   (ec."embedding" <=> %s::vector) AS distance
            FROM "EmbeddingChunk" ec
            WHERE ec."repoId" = %s
            ORDER BY distance ASC
            LIMIT %s
            """,
            [vector_str, repo_id, limit],
        )
        cols = [d[0] for d in cur.description]
        chunks = [dict(zip(cols, row)) for row in cur.fetchall()]

    commit_ids = list({c['commitId'] for c in chunks if c['commitId']})
    commits = {
        c.id: c
        for c in Commit.objects.prefetch_related('prs').filter(id__in=commit_ids)
    }

    results = []
    for ch in chunks:
        commit_obj = commits.get(ch['commitId'])
        if not commit_obj:
            continue
        
        pr_obj = commit_obj.prs.first()

        results.append({
            'chunk_id': ch['id'],
            'distance': float(ch['distance']),
            'commit': {
                'sha': commit_obj.sha,
                'message': commit_obj.message,
                'author_name': commit_obj.author_name,
                'timestamp': commit_obj.timestamp.isoformat() if commit_obj.timestamp else None,
            },
            'pr': {
                'number': pr_obj.github_pr_number,
                'title': pr_obj.title,
            } if pr_obj else None,
            'snippet': ch['content'][:300],
        })

    # Cache results for 15 minutes (900 seconds)
    set_cached(cache_key, results, 900)

    return Response({'results': results})


# ── /search/answer ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def search_answer(request):
    repo_id = request.data.get('repoId')
    query = request.data.get('query')

    if not repo_id or not query:
        return Response({'error': 'Missing repoId or query'}, status=400)

    repo = Repo.objects.filter(id=repo_id).first()
    if not repo:
        return Response({'error': 'Repo not found'}, status=404)

    user = getattr(request, 'user', None)

    # Demo repo allows public access without authentication
    if not repo.is_demo:
        if not user or not user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=401)
        if repo.user_id != user.id:
            return Response({'error': 'Unauthorized'}, status=403)

        # Enforce query limits for FREE tier (HTTP 402)
        allowed, limit_error = check_query_limit(user, repo)
        if not allowed:
            return Response(limit_error, status=402)

        record_usage(user, repo, 'QUERY')

    start_time = time.time()

    def sse_stream():
        from agents.query_planner import run_query_planner
        source_commit_count = 0
        try:
            for event in run_query_planner(query, repo_id):
                if event.get('type') == 'commit_results' or 'commits' in event:
                    commits_list = event.get('commits', [])
                    source_commit_count = max(source_commit_count, len(commits_list))
                yield f'data: {json.dumps(event)}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'
        finally:
            elapsed_ms = int((time.time() - start_time) * 1000)
            try:
                QueryLog.objects.create(
                    user=user if (user and user.is_authenticated) else None,
                    repo=repo,
                    question=query,
                    response_time_ms=elapsed_ms,
                    source_commit_count=source_commit_count,
                )
            except Exception as log_err:
                print(f"[QueryLog Error]: {log_err}")

    response = StreamingHttpResponse(sse_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
