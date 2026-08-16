import os
import uuid
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gitlore.settings')
django.setup()

from celery import shared_task
from django.db import connection
from apps.repos.models import Commit
from lib.embedding import embed_text

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    _splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=64)
except ImportError:
    _splitter = None


def _chunk_text(text: str) -> list[str]:
    if _splitter:
        docs = _splitter.create_documents([text])
        return [d.page_content for d in docs]
    # Fallback: simple fixed-size chunks
    size = 512
    return [text[i:i + size] for i in range(0, len(text), size)]


@shared_task(name='workers.embed_commits.embed_commit')
def embed_commit(commit_id: str, repo_id: str):
    try:
        commit = Commit.objects.prefetch_related('prs__comments').get(id=commit_id)
    except Commit.DoesNotExist:
        print(f'[Embed] Commit {commit_id} not found')
        return

    print(f'[Embed] Embedding commit {commit.sha}')

    document = f'Commit Message: {commit.message}\n'
    document += f'Author: {commit.author_name or ""} <{commit.author_email or ""}>\n'
    for pr in commit.prs.all():
        document += f'\nPull Request: {pr.title}\n'
        if pr.body:
            document += f'PR Body: {pr.body}\n'
        sorted_comments = sorted(pr.comments.all(), key=lambda c: len(c.body), reverse=True)[:5]
        for comment in sorted_comments:
            document += f'Comment by {comment.author_login}: {comment.body}\n'

    document = document[:6000]
    chunks = _chunk_text(document)

    with connection.cursor() as cur:
        for i, chunk_text in enumerate(chunks):
            vector = embed_text(chunk_text)
            vector_str = '[' + ','.join(str(v) for v in vector) + ']'
            metadata = {'chunkIndex': i, 'totalChunks': len(chunks), 'sha': commit.sha}
            cur.execute(
                """
                INSERT INTO "EmbeddingChunk" ("id", "repoId", "commitId", "content", "metadata", "createdAt", "embedding")
                VALUES (%s, %s, %s, %s, %s::jsonb, NOW(), %s::vector)
                """,
                [str(uuid.uuid4()), repo_id, commit_id, chunk_text,
                 __import__('json').dumps(metadata), vector_str],
            )

    print(f'[Embed] Done: {len(chunks)} chunks for {commit.sha}')
