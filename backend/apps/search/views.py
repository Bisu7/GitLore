import json
from django.db import connection
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.repos.models import Repo, Commit, EmbeddingChunk
from lib.embedding import embed_text

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
                'timestamp': commit_obj.timestamp,
            },
            'pr': {
                'number': pr_obj.github_pr_number,
                'title': pr_obj.title,
            } if pr_obj else None,
            'snippet': ch['content'][:300],
        })

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
            import openai
            from django.conf import settings
            import google.generativeai as genai
            
            # 1. Embed query
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            res_emb = client.embeddings.create(model="text-embedding-3-large", input=[query])
            vector = res_emb.data[0].embedding
            vector_str = '[' + ','.join(str(v) for v in vector) + ']'
            
            # 2. Run pgvector search for top 5 chunks
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT ec."commitId", ec."content"
                    FROM "EmbeddingChunk" ec
                    WHERE ec."repoId" = %s
                    ORDER BY (ec."embedding" <=> %s::vector) ASC
                    LIMIT 5
                    """,
                    [repo_id, vector_str],
                )
                chunks = cur.fetchall()
            
            # 3. Build context string and sources
            commit_ids = list({c[0] for c in chunks})
            commits = {c.id: c for c in Commit.objects.filter(id__in=commit_ids)}
            
            context_pieces = []
            sources_map = {}
            
            for commit_id, content in chunks:
                c_obj = commits.get(commit_id)
                if not c_obj:
                    continue
                date = str(c_obj.timestamp)
                context_pieces.append(f"Commit {c_obj.sha} by {c_obj.author_name} on {date}:\n{content}")
                
                if c_obj.sha not in sources_map:
                    sources_map[c_obj.sha] = {
                        "sha": c_obj.sha,
                        "message": c_obj.message,
                        "author": c_obj.author_name
                    }
                    
            context_str = "\n\n".join(context_pieces)
            
            # 4. Call Gemini
            system_prompt = "You are an expert software historian. Answer the developer's question using only the commit context below. Cite specific commit SHAs and PR numbers as evidence. Be direct and precise."
            full_prompt = f"{system_prompt}\n\nContext:\n{context_str}\n\nQuestion: {query}"
            
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-2.5-flash')
            res_gen = model.generate_content(full_prompt, stream=True)
            
            # 5. Stream chunks
            for chunk in res_gen:
                if chunk.text:
                    yield f'data: {json.dumps({"chunk": chunk.text})}\n\n'
                    
            yield f'data: {json.dumps({"done": True, "sources": list(sources_map.values())})}\n\n'
            
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

    response = StreamingHttpResponse(sse_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
