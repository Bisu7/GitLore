import os
import uuid
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gitlore.settings')
django.setup()

from celery import shared_task
from django.db import connection
from django.conf import settings
from apps.repos.models import Repo, Commit, EmbeddingChunk
import openai
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Initialize OpenAI client
client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)


def _get_document(commit: Commit) -> str:
    document = f'Commit Message: {commit.message}\n'
    document += f'Author: {commit.author_name or ""} <{commit.author_email or ""}>\n'
    for pr in commit.prs.all():
        document += f'\nPull Request: {pr.title}\n'
        if pr.body:
            document += f'PR Body: {pr.body}\n'
        sorted_comments = sorted(pr.comments.all(), key=lambda c: len(c.body), reverse=True)[:5]
        for comment in sorted_comments:
            document += f'Comment by {comment.author_login}: {comment.body}\n'
    return document[:6000]


@shared_task(name='embeddings.tasks.embed_repo_commits')
def embed_repo_commits(repo_id: str):
    print(f'[Embed] Starting embedding pipeline for repo {repo_id}')
    
    # 1. Fetch all Commits that do not yet have EmbeddingChunk rows
    commits = Commit.objects.prefetch_related('prs__comments').filter(
        repo_id=repo_id,
        chunks__isnull=True
    ).distinct()

    if not commits.exists():
        print(f'[Embed] No new commits to embed for repo {repo_id}')
        return

    print(f'[Embed] Found {commits.count()} commits to embed')

    # 2 & 3. Build documents and split into chunks
    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=64)
    all_chunks_info = []

    for commit in commits:
        doc = _get_document(commit)
        chunks = splitter.create_documents([doc])
        for i, chunk_doc in enumerate(chunks):
            all_chunks_info.append({
                'commit': commit,
                'text': chunk_doc.page_content,
                'index': i,
                'total': len(chunks)
            })

    # 4. Embed chunks in batches of 20
    batch_size = 20
    db_chunks_to_create = []

    for i in range(0, len(all_chunks_info), batch_size):
        batch = all_chunks_info[i:i+batch_size]
        texts = [item['text'] for item in batch]
        
        try:
            response = client.embeddings.create(
                model="text-embedding-3-large",
                input=texts
            )
            
            for j, item in enumerate(batch):
                embedding = response.data[j].embedding
                
                # We format the embedding as a string for pgvector insertion
                vector_str = '[' + ','.join(str(v) for v in embedding) + ']'
                
                db_chunks_to_create.append({
                    'id': str(uuid.uuid4()),
                    'repo_id': repo_id,
                    'commit_id': item['commit'].id,
                    'content': item['text'],
                    'metadata': {
                        'chunkIndex': item['index'],
                        'totalChunks': item['total'],
                        'sha': item['commit'].sha
                    },
                    'embedding': vector_str
                })
        except Exception as e:
            print(f'[Embed] Error creating embeddings for batch: {e}')
            continue

    # 5. Bulk create EmbeddingChunk rows using raw SQL to support pgvector casting
    if db_chunks_to_create:
        import json
        with connection.cursor() as cur:
            for chunk_data in db_chunks_to_create:
                cur.execute(
                    """
                    INSERT INTO "EmbeddingChunk" ("id", "repoId", "commitId", "content", "metadata", "createdAt", "embedding")
                    VALUES (%s, %s, %s, %s, %s::jsonb, NOW(), %s::vector)
                    """,
                    [
                        chunk_data['id'],
                        chunk_data['repo_id'],
                        chunk_data['commit_id'],
                        chunk_data['content'],
                        json.dumps(chunk_data['metadata']),
                        chunk_data['embedding']
                    ]
                )
        print(f'[Embed] Successfully inserted {len(db_chunks_to_create)} embedding chunks for repo {repo_id}')
    else:
        print(f'[Embed] No embedding chunks were created')
