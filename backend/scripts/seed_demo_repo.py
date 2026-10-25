import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import requests

# Setup Django if standalone
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gitlore.settings')

import django
django.setup()

from apps.repos.models import User, Repo, Commit, CommitFile, PR, PRComment, EmbeddingChunk, ModuleSnapshot
from lib.embedding import embed_text
from lib.cache import invalidate_repo_cache


def seed_demo_repo():
    print("=== Seeding Public Demo Repo (vercel/next.js) ===")
    
    # 1. Create or get Demo User
    demo_user, _ = User.objects.get_or_create(
        id='demo-user',
        defaults={
            'email': 'demo@gitlore.dev',
            'name': 'Demo Next.js Explorer',
            'avatar_url': 'https://avatars.githubusercontent.com/u/14985020?s=200&v=4',
            'onboarding_complete': True,
        }
    )
    print(f"Demo User: {demo_user.id} ({demo_user.email})")

    # 2. Create or get Demo Repo
    demo_repo, _ = Repo.objects.update_or_create(
        github_repo_id='demo-vercel-nextjs',
        defaults={
            'user': demo_user,
            'full_name': 'vercel/next.js',
            'default_branch': 'canary',
            'is_demo': True,
            'ingestion_status': 'PROCESSING',
            'ingestion_progress': 10,
        }
    )
    print(f"Demo Repo: {demo_repo.full_name} (ID: {demo_repo.id})")

    # 3. Fetch public commits from GitHub API (last 6 months)
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()
    url = f"https://api.github.com/repos/vercel/next.js/commits?since={six_months_ago}&per_page=30"
    headers = {'User-Agent': 'GitLore-Demo-Seeder', 'Accept': 'application/vnd.github.v3+json'}

    print(f"Fetching commits from GitHub API: {url}...")
    try:
        res = requests.get(url, headers=headers, timeout=15)
        raw_commits = res.json() if res.ok else []
    except Exception as e:
        print(f"GitHub API fetch failed ({e}). Generating fallback demo commits...")
        raw_commits = []

    # If GitHub rate limit reached or offline, fallback commits so the demo is always fully populated
    if not isinstance(raw_commits, list) or len(raw_commits) == 0:
        raw_commits = [
            {
                'sha': 'a81f3d24c0e9b4129b01859c2185b194098231aa',
                'commit': {
                    'message': 'fix(turbopack): optimize HMR update propagation latency for dynamic routes',
                    'author': {'name': 'Tim Neutkens', 'email': 'tim@vercel.com', 'date': (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()}
                },
                'files': [{'filename': 'packages/next-swc/crates/core/src/lib.rs', 'additions': 45, 'deletions': 12}]
            },
            {
                'sha': 'b92e4d35e1f0c5230c12960d3296c205109342bb',
                'commit': {
                    'message': 'feat(app-router): introduce parallel route interception with cached payload headers',
                    'author': {'name': 'Delba de Oliveira', 'email': 'delba@vercel.com', 'date': (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
                },
                'files': [{'filename': 'packages/next/src/client/components/app-router.tsx', 'additions': 120, 'deletions': 34}]
            },
            {
                'sha': 'c03f5e46f2a1d6341d23071e4307d316210453cc',
                'commit': {
                    'message': 'refactor(server): decouple streaming boundary flush from React Server Components stream',
                    'author': {'name': 'Sebastian Markbåge', 'email': 'seb@vercel.com', 'date': (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()}
                },
                'files': [{'filename': 'packages/next/src/server/app-render/rsc.tsx', 'additions': 88, 'deletions': 92}]
            },
            {
                'sha': 'd14a6f57a3b2e7452e34182f5418e427321564dd',
                'commit': {
                    'message': 'perf(image-optimization): cache animated WebP headers in edge storage adapter',
                    'author': {'name': 'Lee Robinson', 'email': 'lee@vercel.com', 'date': (datetime.now(timezone.utc) - timedelta(days=21)).isoformat()}
                },
                'files': [{'filename': 'packages/next/src/server/image-optimizer.ts', 'additions': 64, 'deletions': 15}]
            },
            {
                'sha': 'e25b7a68b4c3f8563f45293a6529f538432675ee',
                'commit': {
                    'message': 'docs: add architecture explanation for Server Actions revalidation lifecycle',
                    'author': {'name': 'Shu Ding', 'email': 'shu@vercel.com', 'date': (datetime.now(timezone.utc) - timedelta(days=35)).isoformat()}
                },
                'files': [{'filename': 'docs/02-app/02-api-reference/04-functions/revalidatePath.mdx', 'additions': 40, 'deletions': 4}]
            }
        ]

    created_commits = []
    print(f"Processing {len(raw_commits)} commits...")

    for item in raw_commits:
        sha = item.get('sha')
        commit_data = item.get('commit', {})
        msg = commit_data.get('message', '')
        author_info = commit_data.get('author', {})
        author_name = author_info.get('name', 'Next.js Contributor')
        author_email = author_info.get('email', 'dev@vercel.com')
        date_str = author_info.get('date') or datetime.now(timezone.utc).isoformat()
        
        try:
            ts = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except Exception:
            ts = datetime.now(timezone.utc)

        db_commit, _ = Commit.objects.update_or_create(
            repo=demo_repo,
            sha=sha,
            defaults={
                'message': msg,
                'author_name': author_name,
                'author_email': author_email,
                'timestamp': ts,
            }
        )
        created_commits.append(db_commit)

        # Commit Files
        files = item.get('files', [])
        if not files:
            # Default Next.js file for mock
            files = [{'filename': 'packages/next/src/client/index.ts', 'additions': 20, 'deletions': 5}]

        for f in files:
            CommitFile.objects.update_or_create(
                commit=db_commit,
                file_path=f.get('filename', 'packages/next/src/core.ts'),
                defaults={
                    'additions': f.get('additions', 10),
                    'deletions': f.get('deletions', 2),
                }
            )

        # Create or update Embedding Chunk
        content_doc = f"Commit {sha[:7]} by {author_name} ({author_email}):\n{msg}\nFiles: {', '.join(f.get('filename', '') for f in files)}"
        EmbeddingChunk.objects.update_or_create(
            repo=demo_repo,
            commit=db_commit,
            defaults={
                'content': content_doc,
                'metadata': {
                    'sha': sha,
                    'author': author_name,
                    'files': [f.get('filename') for f in files],
                }
            }
        )

    # 4. Generate Module Snapshots for Drift Detection
    modules = ['packages/next', 'packages/next-swc', 'examples', 'docs']
    now = datetime.now(timezone.utc)

    for i, mod in enumerate(modules):
        ModuleSnapshot.objects.update_or_create(
            repo=demo_repo,
            module_name=mod,
            snapshot_date=now - timedelta(days=i * 5),
            defaults={
                'drift_score': 0.12 * (i + 1),
                'similarity_to_previous': 0.88 - (0.05 * i),
                'ai_explanation': f"Recent commits refactored internal interfaces in {mod}, improving caching boundaries and tree-shaking.",
                'metadata': {
                    'is_drifting': (i == 1), # one drifting module
                    'topFiles': [f"{mod}/src/index.ts", f"{mod}/src/router.ts"]
                }
            }
        )

    # 5. Mark ingestion complete
    demo_repo.ingestion_status = 'COMPLETE'
    demo_repo.ingestion_progress = 100.0
    demo_repo.save(update_fields=['ingestion_status', 'ingestion_progress'])

    # Invalidate caches
    invalidate_repo_cache(demo_repo.id)

    print("=== Demo Repo Seeding Successfully Completed ===")
    return demo_repo


if __name__ == '__main__':
    seed_demo_repo()
