import os
import re
import shutil
import requests
from celery import shared_task
from django.conf import settings
from git import Repo as GitRepo
from cryptography.fernet import Fernet
from apps.repos.models import Repo, Commit, CommitFile, TicketRef, PR, PRComment


@shared_task(name='ingestion.tasks.embed_repo_commits')
def embed_repo_commits(repo_id: str):
    from workers.embed_commits import embed_commit
    commits = Commit.objects.filter(repo_id=repo_id)
    for commit in commits:
        embed_commit.delay(commit.id, repo_id)
    print(f'[Embed] Enqueued {commits.count()} embedding jobs for repo {repo_id}')


@shared_task(name='ingestion.tasks.ingest_repo')
def ingest_repo(repo_id: str):
    try:
        repo = Repo.objects.select_related('user').get(id=repo_id)
        user = repo.user

        if not user.access_token:
            raise ValueError('GitHub access token missing')

        # Decrypt token
        f = Fernet(settings.FERNET_KEY.encode())
        token = f.decrypt(user.access_token.encode()).decode()

        repo.ingestion_status = 'PROCESSING'
        repo.ingestion_progress = 0
        repo.save(update_fields=['ingestion_status', 'ingestion_progress'])

        # Clone or Pull
        # Use settings.REPOS_TMP_DIR for Windows compatibility instead of hardcoded /tmp/repos/
        repo_path = settings.REPOS_TMP_DIR / repo_id
        clone_url = f'https://oauth2:{token}@github.com/{repo.full_name}.git'
        
        if repo_path.exists():
            print(f'Pulling {repo.full_name}...')
            git_repo = GitRepo(str(repo_path))
            git_repo.remotes.origin.pull()
        else:
            repo_path.parent.mkdir(parents=True, exist_ok=True)
            print(f'Cloning {repo.full_name}...')
            git_repo = GitRepo.clone_from(clone_url, str(repo_path))

        commits = list(git_repo.iter_commits(all=True))
        total = len(commits)
        print(f'Found {total} commits')

        processed = 0
        ticket_regex = re.compile(r'([A-Z]+-\d+)|(#\d+)|(closes\s+#\d+)', re.IGNORECASE)

        for git_commit in commits:
            # Skip if already exists
            if Commit.objects.filter(repo=repo, sha=git_commit.hexsha).exists():
                processed += 1
                continue

            full_message = git_commit.message or ''
            db_commit, _ = Commit.objects.update_or_create(
                repo=repo,
                sha=git_commit.hexsha,
                defaults={
                    'message': full_message,
                    'author_email': git_commit.author.email,
                    'author_name': git_commit.author.name,
                    'timestamp': git_commit.authored_datetime,
                    'parent_shas': [p.hexsha for p in git_commit.parents],
                }
            )

            # Ticket refs
            for match in ticket_regex.finditer(full_message):
                raw_ref = match.group(0)
                if re.match(r'[A-Z]+-\d+', raw_ref, re.IGNORECASE):
                    source, external_id = 'JIRA', raw_ref
                elif re.match(r'#\d+', raw_ref):
                    source = 'GITHUB'
                    external_id = re.search(r'#(\d+)', raw_ref).group(1)
                elif re.match(r'closes\s+#\d+', raw_ref, re.IGNORECASE):
                    source = 'GITHUB'
                    external_id = re.search(r'#(\d+)', raw_ref).group(1)
                else:
                    source, external_id = 'UNKNOWN', raw_ref
                TicketRef.objects.update_or_create(
                    commit=db_commit, 
                    source=source, 
                    external_id=external_id, 
                    defaults={'raw_ref': raw_ref}
                )

            # Changed files
            try:
                for file_path, stats in git_commit.stats.files.items():
                    CommitFile.objects.update_or_create(
                        commit=db_commit, 
                        file_path=file_path, 
                        defaults={
                            'additions': stats.get('insertions', 0),
                            'deletions': stats.get('deletions', 0),
                        }
                    )
            except Exception:
                pass

            # PRs from GitHub API
            try:
                pr_res = requests.get(
                    f'https://api.github.com/repos/{repo.full_name}/commits/{git_commit.hexsha}/pulls',
                    headers={
                        'Authorization': f'Bearer {token}',
                        'Accept': 'application/vnd.github.groot-preview+json',
                    },
                )
                if pr_res.ok:
                    for pr_data in pr_res.json():
                        pr_obj, _ = PR.objects.update_or_create(
                            repo=repo,
                            github_pr_number=pr_data['number'],
                            defaults={
                                'commit': db_commit,
                                'title': pr_data['title'],
                                'body': pr_data.get('body'),
                                'state': pr_data['state'],
                                'merged_at': pr_data.get('merged_at'),
                            }
                        )
                        comments_res = requests.get(
                            f'https://api.github.com/repos/{repo.full_name}/pulls/{pr_data["number"]}/comments',
                            headers={'Authorization': f'Bearer {token}'},
                        )
                        if comments_res.ok:
                            for c in comments_res.json():
                                PRComment.objects.update_or_create(
                                    pr=pr_obj,
                                    github_comment_id=str(c['id']),
                                    defaults={
                                        'author_login': c.get('user', {}).get('login', 'unknown'),
                                        'body': c['body'],
                                        'created_at': c['created_at'],
                                    }
                                )
            except Exception:
                pass

            processed += 1
            if processed % 100 == 0:
                percent = round((processed / total) * 100)
                Repo.objects.filter(id=repo_id).update(ingestion_progress=percent)

        Repo.objects.filter(id=repo_id).update(ingestion_status='COMPLETE', ingestion_progress=100)
        print(f'Sync complete: {processed} commits for {repo.full_name}')

        # Chain the embedding task
        embed_repo_commits.delay(repo_id)

    except Exception as e:
        Repo.objects.filter(id=repo_id).update(ingestion_status='FAILED')
        raise e
