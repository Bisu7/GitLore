import os
import re
import shutil
import requests
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gitlore.settings')
django.setup()

from celery import shared_task
from django.conf import settings
from git import Repo as GitRepo
from apps.repos.models import Repo, Commit, CommitFile, TicketRef, PR, PRComment


@shared_task(name='workers.repo_sync.sync_repo')
def sync_repo(repo_id: str):
    repo = Repo.objects.select_related('user').get(id=repo_id)
    user = repo.user

    if not user.access_token:
        raise ValueError('GitHub access token missing')

    repo.ingestion_status = 'PROCESSING'
    repo.ingestion_progress = 0
    repo.save(update_fields=['ingestion_status', 'ingestion_progress'])

    # Clone
    repo_path = settings.REPOS_TMP_DIR / repo_id
    if repo_path.exists():
        shutil.rmtree(repo_path)
    repo_path.mkdir(parents=True, exist_ok=True)

    clone_url = f'https://{user.access_token}@github.com/{repo.full_name}.git'
    print(f'Cloning {repo.full_name}...')
    git_repo = GitRepo.clone_from(clone_url, str(repo_path))

    commits = list(git_repo.iter_commits('--all'))
    total = len(commits)
    print(f'Found {total} commits')

    processed = 0
    commit_ids_for_embed = []

    ticket_regex = re.compile(r'([A-Z]+-\d+)|(#\d+)|(closes\s+#\d+)', re.IGNORECASE)

    for git_commit in commits:
        # Skip if already exists
        if Commit.objects.filter(repo=repo, sha=git_commit.hexsha).exists():
            continue

        full_message = git_commit.message or ''
        db_commit = Commit.objects.create(
            repo=repo,
            sha=git_commit.hexsha,
            message=full_message,
            author_email=git_commit.author.email,
            author_name=git_commit.author.name,
            timestamp=git_commit.authored_datetime,
            parent_shas=[p.hexsha for p in git_commit.parents],
        )

        # Ticket refs
        for match in ticket_regex.finditer(full_message):
            raw_ref = match.group(0)
            if re.match(r'[A-Z]+-\d+', raw_ref, re.IGNORECASE):
                source, external_id = 'JIRA', raw_ref
            elif re.match(r'#\d+', raw_ref):
                source = 'GITHUB'
                external_id = re.search(r'#(\d+)', raw_ref).group(1)
            else:
                source, external_id = 'UNKNOWN', raw_ref
            TicketRef.objects.create(commit=db_commit, source=source, external_id=external_id, raw_ref=raw_ref)

        # Changed files
        try:
            if git_commit.parents:
                diffs = git_commit.parents[0].diff(git_commit, create_patch=True)
            else:
                diffs = git_commit.diff(None, create_patch=True)
            for diff in diffs:
                file_path = diff.b_path or diff.a_path
                patch = diff.diff.decode('utf-8', errors='replace') if diff.diff else ''
                CommitFile.objects.create(commit=db_commit, file_path=file_path, patch=patch)
        except Exception:
            pass

        # PRs from GitHub API
        try:
            pr_res = requests.get(
                f'https://api.github.com/repos/{repo.full_name}/commits/{git_commit.hexsha}/pulls',
                headers={
                    'Authorization': f'Bearer {user.access_token}',
                    'Accept': 'application/vnd.github.groot-preview+json',
                },
            )
            if pr_res.ok:
                for pr_data in pr_res.json():
                    pr_obj = PR.objects.create(
                        repo=repo,
                        commit=db_commit,
                        github_pr_number=pr_data['number'],
                        title=pr_data['title'],
                        body=pr_data.get('body'),
                        state=pr_data['state'],
                        merged_at=pr_data.get('merged_at'),
                    )
                    comments_res = requests.get(
                        f'https://api.github.com/repos/{repo.full_name}/pulls/{pr_data["number"]}/comments',
                        headers={'Authorization': f'Bearer {user.access_token}'},
                    )
                    if comments_res.ok:
                        for c in comments_res.json():
                            PRComment.objects.create(
                                pr=pr_obj,
                                github_comment_id=str(c['id']),
                                author_login=c.get('user', {}).get('login', 'unknown'),
                                body=c['body'],
                                created_at=c['created_at'],
                            )
        except Exception:
            pass

        commit_ids_for_embed.append(db_commit.id)
        processed += 1
        if processed % 50 == 0:
            repo.ingestion_progress = round((processed / total) * 100)
            repo.save(update_fields=['ingestion_progress'])

    repo.ingestion_status = 'COMPLETE'
    repo.ingestion_progress = 100
    repo.save(update_fields=['ingestion_status', 'ingestion_progress'])
    print(f'Sync complete: {processed} commits for {repo.full_name}')

    # Enqueue embedding jobs
    from workers.embed_commits import embed_commit
    for commit_id in commit_ids_for_embed:
        embed_commit.delay(commit_id, repo_id)

    print('Embedding jobs enqueued')
