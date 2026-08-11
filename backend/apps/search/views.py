import json
from django.db import connection
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.repos.models import Repo, Commit, EmbeddingChunk
from lib.embedding import embed_text
from agents.query_planner import run_query_planner


# ── /search ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def search(request):
    repo_id = request.data.get('repoId')
    query = request.data.get('query')
    limit = int(request.data.get('limit', 10))

    if not repo_id or not query:
        return Response({'error': 'Missing repoId or query'}, status=400)

    user = request.user
    if not Repo.objects.filter(id=repo_id, user=user).exists():
        return Response({'error': 'Unauthorized'}, status=403)

    # Embed query
    vector = embed_text(query)
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
        c.id: {
            'sha': c.sha, 'message': c.message, 'authorName': c.author_name, 'timestamp': c.timestamp,
            'prs': list(c.prs.values('id', 'title', 'github_pr_number', 'state')),
            'ticketRefs': list(c.ticket_refs.values('id', 'source', 'external_id', 'raw_ref')),
        }
        for c in Commit.objects.prefetch_related('prs', 'ticket_refs').filter(id__in=commit_ids)
    }

    results = [{
        'id': ch['id'],
        'content': ch['content'],
        'distance': float(ch['distance']),
        'metadata': ch['metadata'],
        'commit': commits.get(ch['commitId']),
    } for ch in chunks]

    return Response({'results': results})


# ── /search/answer ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def search_answer(request):
    repo_id = request.data.get('repoId')
    query = request.data.get('query')

    if not repo_id or not query:
        return Response({'error': 'Missing repoId or query'}, status=400)

    user = request.user
    if not Repo.objects.filter(id=repo_id, user=user).exists():
        return Response({'error': 'Unauthorized'}, status=403)

    def sse_stream():
        try:
            for event in run_query_planner(query, repo_id):
                yield f'data: {json.dumps(event)}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

    response = StreamingHttpResponse(sse_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
