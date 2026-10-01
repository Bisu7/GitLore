import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gitlore.settings')
django.setup()

from celery import shared_task
from apps.repos.models import Commit
from graph.connection import driver
import pathlib

@shared_task(name='graph.tasks.build_repo_graph')
def build_repo_graph(repo_id: str):
    if not driver:
        print("[Graph] Neo4j driver not initialized.")
        return

    print(f"[Graph] Building graph for repo {repo_id}")
    commits = Commit.objects.prefetch_related('files', 'ticket_refs', 'prs').filter(repo_id=repo_id)

    def process_commit(tx, commit_data):
        # 1. Author and Commit
        tx.run(
            """
            MERGE (a:Author {email: $author_email})
            ON CREATE SET a.name = $author_name
            MERGE (c:Commit {sha: $sha, repo_id: $repo_id})
            ON CREATE SET c.message = $message, c.timestamp = $timestamp
            MERGE (a)-[:AUTHORED {timestamp: $timestamp}]->(c)
            """,
            author_email=commit_data['author_email'] or 'unknown@example.com',
            author_name=commit_data['author_name'] or 'Unknown',
            sha=commit_data['sha'],
            repo_id=commit_data['repo_id'],
            message=commit_data['message'],
            timestamp=commit_data['timestamp'].isoformat()
        )

        # 2. Parent Shas (PARENT_OF)
        for p_sha in commit_data['parent_shas']:
            tx.run(
                """
                MATCH (c:Commit {sha: $sha, repo_id: $repo_id})
                MERGE (p:Commit {sha: $p_sha, repo_id: $repo_id})
                MERGE (p)-[:PARENT_OF]->(c)
                """,
                sha=commit_data['sha'],
                repo_id=commit_data['repo_id'],
                p_sha=p_sha
            )

        # 3. Files and Modules
        for file_data in commit_data['files']:
            path = file_data['file_path']
            # module is the top-level directory, e.g. "backend" from "backend/apps/repos.py".
            # If no directory, module = '/'
            parts = pathlib.Path(path).parts
            module_name = parts[0] if len(parts) > 1 else '/'
            
            tx.run(
                """
                MATCH (c:Commit {sha: $sha, repo_id: $repo_id})
                MERGE (f:File {path: $path, repo_id: $repo_id})
                MERGE (m:Module {name: $module_name, repo_id: $repo_id})
                MERGE (c)-[:TOUCHES {additions: $additions, deletions: $deletions}]->(f)
                MERGE (f)-[:BELONGS_TO]->(m)
                """,
                sha=commit_data['sha'],
                repo_id=commit_data['repo_id'],
                path=path,
                module_name=module_name,
                additions=file_data['additions'],
                deletions=file_data['deletions']
            )

        # 4. PRs
        for pr in commit_data['prs']:
            tx.run(
                """
                MATCH (c:Commit {sha: $sha, repo_id: $repo_id})
                MERGE (p:PR {number: $number, repo_id: $repo_id})
                ON CREATE SET p.title = $title
                MERGE (c)-[:HAS_PR]->(p)
                """,
                sha=commit_data['sha'],
                repo_id=commit_data['repo_id'],
                number=pr['github_pr_number'],
                title=pr['title']
            )

        # 5. Tickets
        for ticket in commit_data['ticket_refs']:
            tx.run(
                """
                MATCH (c:Commit {sha: $sha, repo_id: $repo_id})
                MERGE (t:Ticket {external_id: $external_id, source: $source, repo_id: $repo_id})
                MERGE (c)-[:REFS_TICKET]->(t)
                """,
                sha=commit_data['sha'],
                repo_id=commit_data['repo_id'],
                external_id=ticket['external_id'],
                source=ticket['source']
            )

    with driver.session() as session:
        for commit in commits:
            commit_data = {
                'sha': commit.sha,
                'repo_id': commit.repo_id,
                'author_email': commit.author_email,
                'author_name': commit.author_name,
                'message': commit.message,
                'timestamp': commit.timestamp,
                'parent_shas': commit.parent_shas,
                'files': [{'file_path': f.file_path, 'additions': f.additions, 'deletions': f.deletions} for f in commit.files.all()],
                'prs': [{'github_pr_number': pr.github_pr_number, 'title': pr.title} for pr in commit.prs.all()],
                'ticket_refs': [{'external_id': tr.external_id, 'source': tr.source} for tr in commit.ticket_refs.all()]
            }
            session.execute_write(process_commit, commit_data)
            
    print(f"[Graph] Finished building graph for repo {repo_id}")
