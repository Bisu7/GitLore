import os
import re
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gitlore.settings')
django.setup()

from celery import shared_task
from apps.repos.models import Commit
from lib.neo4j_client import get_driver
from utils.module_detector import get_module_from_file_path


@shared_task(name='workers.build_graph.build_graph')
def build_graph(repo_id: str):
    print(f'[Graph] Building graph for repo {repo_id}')
    commits = (
        Commit.objects
        .prefetch_related('files', 'ticket_refs', 'prs')
        .filter(repo_id=repo_id)
    )

    driver = get_driver()
    with driver.session() as session:
        for commit in commits:
            # Merge Commit node
            session.execute_write(lambda tx, c=commit: tx.run(
                'MERGE (n:Commit {repoId: $r, sha: $s}) SET n.message=$m, n.timestamp=$t',
                r=repo_id, s=c.sha, m=c.message, t=c.timestamp.isoformat(),
            ))

            # Author
            if commit.author_email:
                session.execute_write(lambda tx, c=commit: tx.run(
                    '''MERGE (a:Author {email: $e}) ON CREATE SET a.name=$n
                       WITH a MATCH (c:Commit {repoId:$r, sha:$s})
                       MERGE (a)-[rel:AUTHORED]->(c) SET rel.timestamp=$t''',
                    e=c.author_email, n=c.author_name or 'Unknown',
                    r=repo_id, s=c.sha, t=c.timestamp.isoformat(),
                ))

            # Files + Modules
            for f in commit.files.all():
                module_name = get_module_from_file_path(f.file_path)
                session.execute_write(lambda tx, c=commit, f=f, m=module_name: tx.run(
                    '''MATCH (c:Commit {repoId:$r, sha:$s})
                       MERGE (file:File {repoId:$r, path:$p})
                       MERGE (c)-[t:TOUCHES]->(file) SET t.additions=$a, t.deletions=$d
                       MERGE (mod:Module {repoId:$r, name:$m})
                       MERGE (file)-[:BELONGS_TO]->(mod)''',
                    r=repo_id, s=c.sha, p=f.file_path,
                    a=f.additions, d=f.deletions, m=m,
                ))

            # Tickets
            for ticket in commit.ticket_refs.all():
                session.execute_write(lambda tx, c=commit, t=ticket: tx.run(
                    '''MATCH (c:Commit {repoId:$r, sha:$s})
                       MERGE (tk:Ticket {repoId:$r, externalId:$eid, source:$src})
                       MERGE (c)-[:REFS_TICKET]->(tk)''',
                    r=repo_id, s=c.sha, eid=t.external_id, src=t.source,
                ))

            # PRs
            for pr in commit.prs.all():
                session.execute_write(lambda tx, c=commit, p=pr: tx.run(
                    '''MATCH (c:Commit {repoId:$r, sha:$s})
                       MERGE (p:PR {repoId:$r, number:$n}) SET p.title=$title
                       MERGE (c)-[:HAS_PR]->(p)''',
                    r=repo_id, s=c.sha, n=p.github_pr_number, title=p.title,
                ))

            # Parent commits
            for parent_sha in (commit.parent_shas or []):
                session.execute_write(lambda tx, c=commit, ps=parent_sha: tx.run(
                    '''MATCH (c:Commit {repoId:$r, sha:$s})
                       MERGE (p:Commit {repoId:$r, sha:$ps})
                       MERGE (p)-[:PARENT_OF]->(c)''',
                    r=repo_id, s=c.sha, ps=ps,
                ))

    print(f'[Graph] Done for repo {repo_id}')
