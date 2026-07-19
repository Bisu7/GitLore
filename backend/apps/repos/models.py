import uuid
from django.db import models
from pgvector.django import VectorField


def gen_cuid():
    return uuid.uuid4().hex


class User(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    github_id = models.CharField(max_length=64, unique=True, null=True, blank=True, db_column='githubId')
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    avatar_url = models.URLField(null=True, blank=True, db_column='avatarUrl')
    access_token = models.TextField(null=True, blank=True, db_column='accessToken')
    created_at = models.DateTimeField(auto_now_add=True, db_column='createdAt')

    @property
    def is_authenticated(self):
        return True

    class Meta:
        db_table = 'User'


class Repo(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='repos', db_column='userId')
    github_repo_id = models.CharField(max_length=64, unique=True, db_column='githubRepoId')
    full_name = models.CharField(max_length=255, db_column='fullName')
    default_branch = models.CharField(max_length=128, null=True, blank=True, db_column='defaultBranch')
    ingestion_status = models.CharField(max_length=32, default='pending', db_column='ingestionStatus')
    ingestion_progress = models.FloatField(default=0, db_column='ingestionProgress')
    created_at = models.DateTimeField(auto_now_add=True, db_column='createdAt')

    class Meta:
        db_table = 'Repo'


class Commit(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    repo = models.ForeignKey(Repo, on_delete=models.CASCADE, related_name='commits', db_column='repoId')
    sha = models.CharField(max_length=64)
    message = models.TextField()
    author_email = models.CharField(max_length=255, null=True, blank=True, db_column='authorEmail')
    author_name = models.CharField(max_length=255, null=True, blank=True, db_column='authorName')
    timestamp = models.DateTimeField()
    parent_shas = models.JSONField(default=list, db_column='parentShas')

    class Meta:
        db_table = 'Commit'


class CommitFile(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    commit = models.ForeignKey(Commit, on_delete=models.CASCADE, related_name='files', db_column='commitId')
    file_path = models.TextField(db_column='filePath')
    additions = models.IntegerField(default=0)
    deletions = models.IntegerField(default=0)
    patch = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'CommitFile'


class TicketRef(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    commit = models.ForeignKey(Commit, on_delete=models.CASCADE, related_name='ticket_refs', db_column='commitId')
    source = models.CharField(max_length=32)
    external_id = models.CharField(max_length=128, db_column='externalId')
    raw_ref = models.CharField(max_length=256, db_column='rawRef')

    class Meta:
        db_table = 'TicketRef'


class PR(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    repo = models.ForeignKey(Repo, on_delete=models.CASCADE, related_name='prs', db_column='repoId')
    commit = models.ForeignKey(Commit, on_delete=models.SET_NULL, null=True, blank=True, related_name='prs', db_column='commitId')
    github_pr_number = models.IntegerField(db_column='githubPrNumber')
    title = models.TextField()
    body = models.TextField(null=True, blank=True)
    state = models.CharField(max_length=32)
    merged_at = models.DateTimeField(null=True, blank=True, db_column='mergedAt')

    class Meta:
        db_table = 'PR'


class PRComment(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    pr = models.ForeignKey(PR, on_delete=models.CASCADE, related_name='comments', db_column='prId')
    github_comment_id = models.CharField(max_length=64, unique=True, db_column='githubCommentId')
    author_login = models.CharField(max_length=128, db_column='authorLogin')
    body = models.TextField()
    created_at = models.DateTimeField(db_column='createdAt')

    class Meta:
        db_table = 'PRComment'


class EmbeddingChunk(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    repo = models.ForeignKey(Repo, on_delete=models.CASCADE, related_name='embedding_chunks', db_column='repoId')
    commit = models.ForeignKey(Commit, on_delete=models.SET_NULL, null=True, blank=True, related_name='chunks', db_column='commitId')
    content = models.TextField()
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_column='createdAt')
    embedding = VectorField(dimensions=384, null=True, blank=True)

    class Meta:
        db_table = 'EmbeddingChunk'


class Ticket(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    repo = models.ForeignKey(Repo, on_delete=models.CASCADE, related_name='tickets', db_column='repoId')
    external_id = models.CharField(max_length=128, db_column='externalId')
    source = models.CharField(max_length=32)
    title = models.TextField()
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=64, null=True, blank=True)
    assignee = models.CharField(max_length=255, null=True, blank=True)
    reporter = models.CharField(max_length=255, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_column='createdAt')
    updated_at = models.DateTimeField(auto_now=True, db_column='updatedAt')

    class Meta:
        db_table = 'Ticket'
        unique_together = [('repo', 'external_id', 'source')]


class Integration(models.Model):
    id = models.CharField(max_length=36, primary_key=True, default=gen_cuid)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='integrations', db_column='userId')
    repo = models.ForeignKey(Repo, on_delete=models.CASCADE, related_name='integrations', db_column='repoId')
    provider = models.CharField(max_length=32)
    access_token = models.TextField(db_column='accessToken')
    refresh_token = models.TextField(null=True, blank=True, db_column='refreshToken')
    cloud_id = models.CharField(max_length=128, null=True, blank=True, db_column='cloudId')
    site_url = models.URLField(null=True, blank=True, db_column='siteUrl')
    created_at = models.DateTimeField(auto_now_add=True, db_column='createdAt')
    updated_at = models.DateTimeField(auto_now=True, db_column='updatedAt')

    class Meta:
        db_table = 'Integration'
        unique_together = [('user', 'repo', 'provider')]
