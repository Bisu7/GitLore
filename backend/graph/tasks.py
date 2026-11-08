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


from django.utils import timezone
from datetime import timedelta
from apps.repos.models import Repo, Commit, CommitFile, ModuleSnapshot
import json
import numpy as np
from django.conf import settings
import openai
import google.generativeai as genai

@shared_task(name='graph.tasks.detect_architecture_drift')
def detect_architecture_drift():
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    
    repos = Repo.objects.all()
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    for repo in repos:
        # Get all distinct modules in the last 30 days
        files = CommitFile.objects.filter(commit__repo_id=repo.id, commit__timestamp__gte=thirty_days_ago)
        module_counts = {}
        for f in files:
            parts = pathlib.Path(f.file_path).parts
            mod = parts[0] if len(parts) > 1 else '/'
            if mod not in module_counts:
                module_counts[mod] = []
            module_counts[mod].append(f)
            
        for mod, mod_files in module_counts.items():
            # top 20 most changed files
            file_freq = {}
            for mf in mod_files:
                file_freq[mf.file_path] = file_freq.get(mf.file_path, 0) + 1
            
            top_files = sorted(file_freq.keys(), key=lambda k: file_freq[k], reverse=True)[:20]
            
            # Get their last commit messages
            doc_parts = []
            for tf in top_files:
                last_commit = Commit.objects.filter(repo_id=repo.id, files__file_path=tf).order_by('-timestamp').first()
                msg = last_commit.message if last_commit else ''
                doc_parts.append(f"{tf}: {msg}")
                
            doc = "\n".join(doc_parts)[:4000]
            
            # Embed
            response = client.embeddings.create(model="text-embedding-3-large", input=[doc])
            vector = response.data[0].embedding
            
            # Find snapshot from 30 days ago
            prev_snap = ModuleSnapshot.objects.filter(repo_id=repo.id, module_name=mod, snapshot_date__lte=thirty_days_ago).order_by('-snapshot_date').first()
            
            similarity = None
            drift_score = None
            ai_explanation = None
            is_drifting = False
            
            if prev_snap and prev_snap.embedding:
                v1 = np.array(vector)
                v2 = np.array(prev_snap.embedding)
                similarity = float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))
                
                if similarity < 0.82:
                    is_drifting = True
                    drift_score = 1.0 - similarity
                    
                    old_doc = prev_snap.metadata.get('doc', '')
                    prompt = f"A software module called '{mod}' has architecturally drifted. Its state 30 days ago focused on: {old_doc}. Its current state focuses on: {doc}. Write 2 sentences explaining what architectural shift occurred and what the team should review."
                    
                    try:
                        res = model.generate_content(prompt)
                        ai_explanation = res.text
                    except Exception as e:
                        ai_explanation = f"Error generating explanation: {e}"
                        
                    # Enqueue drift alert
                    from apps.integrations.slack import send_slack_drift_alert
                    import sys, os
                    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
                    from lib.email import send_drift_alert_email
                    send_slack_drift_alert(repo.id, mod, ai_explanation)
                    send_drift_alert_email(repo.user, repo, mod, ai_explanation)
                        
            ModuleSnapshot.objects.create(
                repo=repo,
                module_name=mod,
                snapshot_date=now,
                similarity_to_previous=similarity,
                drift_score=drift_score,
                ai_explanation=ai_explanation,
                embedding=vector,
                metadata={'doc': doc, 'is_drifting': is_drifting}
            )
