import apps.repos.models
import django.db.models.deletion
import pgvector.django.vector
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Commit',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('sha', models.CharField(max_length=64)),
                ('message', models.TextField()),
                ('author_email', models.CharField(blank=True, db_column='authorEmail', max_length=255, null=True)),
                ('author_name', models.CharField(blank=True, db_column='authorName', max_length=255, null=True)),
                ('timestamp', models.DateTimeField()),
                ('parent_shas', models.JSONField(db_column='parentShas', default=list)),
            ],
            options={
                'db_table': 'Commit',
            },
        ),
        migrations.CreateModel(
            name='Repo',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('github_repo_id', models.CharField(db_column='githubRepoId', max_length=64, unique=True)),
                ('full_name', models.CharField(db_column='fullName', max_length=255)),
                ('default_branch', models.CharField(blank=True, db_column='defaultBranch', max_length=128, null=True)),
                ('ingestion_status', models.CharField(db_column='ingestionStatus', default='pending', max_length=32)),
                ('ingestion_progress', models.FloatField(db_column='ingestionProgress', default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='createdAt')),
            ],
            options={
                'db_table': 'Repo',
            },
        ),
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('github_id', models.CharField(blank=True, max_length=64, null=True, unique=True)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('name', models.CharField(blank=True, max_length=255, null=True)),
                ('avatar_url', models.URLField(blank=True, null=True)),
                ('access_token', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'User',
            },
        ),
        migrations.CreateModel(
            name='CommitFile',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('file_path', models.TextField(db_column='filePath')),
                ('additions', models.IntegerField(default=0)),
                ('deletions', models.IntegerField(default=0)),
                ('patch', models.TextField(blank=True, null=True)),
                ('commit', models.ForeignKey(db_column='commitId', on_delete=django.db.models.deletion.CASCADE, related_name='files', to='repos.commit')),
            ],
            options={
                'db_table': 'CommitFile',
            },
        ),
        migrations.CreateModel(
            name='PR',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('github_pr_number', models.IntegerField(db_column='githubPrNumber')),
                ('title', models.TextField()),
                ('body', models.TextField(blank=True, null=True)),
                ('state', models.CharField(max_length=32)),
                ('merged_at', models.DateTimeField(blank=True, db_column='mergedAt', null=True)),
                ('commit', models.ForeignKey(blank=True, db_column='commitId', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='prs', to='repos.commit')),
                ('repo', models.ForeignKey(db_column='repoId', on_delete=django.db.models.deletion.CASCADE, related_name='prs', to='repos.repo')),
            ],
            options={
                'db_table': 'PR',
            },
        ),
        migrations.CreateModel(
            name='PRComment',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('github_comment_id', models.CharField(db_column='githubCommentId', max_length=64, unique=True)),
                ('author_login', models.CharField(db_column='authorLogin', max_length=128)),
                ('body', models.TextField()),
                ('created_at', models.DateTimeField(db_column='createdAt')),
                ('pr', models.ForeignKey(db_column='prId', on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='repos.pr')),
            ],
            options={
                'db_table': 'PRComment',
            },
        ),
        migrations.CreateModel(
            name='EmbeddingChunk',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('metadata', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='createdAt')),
                ('embedding', pgvector.django.vector.VectorField(blank=True, dimensions=384, null=True)),
                ('commit', models.ForeignKey(blank=True, db_column='commitId', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chunks', to='repos.commit')),
                ('repo', models.ForeignKey(db_column='repoId', on_delete=django.db.models.deletion.CASCADE, related_name='embedding_chunks', to='repos.repo')),
            ],
            options={
                'db_table': 'EmbeddingChunk',
            },
        ),
        migrations.AddField(
            model_name='commit',
            name='repo',
            field=models.ForeignKey(db_column='repoId', on_delete=django.db.models.deletion.CASCADE, related_name='commits', to='repos.repo'),
        ),
        migrations.CreateModel(
            name='TicketRef',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('source', models.CharField(max_length=32)),
                ('external_id', models.CharField(db_column='externalId', max_length=128)),
                ('raw_ref', models.CharField(db_column='rawRef', max_length=256)),
                ('commit', models.ForeignKey(db_column='commitId', on_delete=django.db.models.deletion.CASCADE, related_name='ticket_refs', to='repos.commit')),
            ],
            options={
                'db_table': 'TicketRef',
            },
        ),
        migrations.AddField(
            model_name='repo',
            name='user',
            field=models.ForeignKey(db_column='userId', on_delete=django.db.models.deletion.CASCADE, related_name='repos', to='repos.user'),
        ),
        migrations.CreateModel(
            name='Ticket',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('external_id', models.CharField(db_column='externalId', max_length=128)),
                ('source', models.CharField(max_length=32)),
                ('title', models.TextField()),
                ('description', models.TextField(blank=True, null=True)),
                ('status', models.CharField(blank=True, max_length=64, null=True)),
                ('assignee', models.CharField(blank=True, max_length=255, null=True)),
                ('reporter', models.CharField(blank=True, max_length=255, null=True)),
                ('url', models.URLField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='createdAt')),
                ('updated_at', models.DateTimeField(auto_now=True, db_column='updatedAt')),
                ('repo', models.ForeignKey(db_column='repoId', on_delete=django.db.models.deletion.CASCADE, related_name='tickets', to='repos.repo')),
            ],
            options={
                'db_table': 'Ticket',
                'unique_together': {('repo', 'external_id', 'source')},
            },
        ),
        migrations.CreateModel(
            name='Integration',
            fields=[
                ('id', models.CharField(default=apps.repos.models.gen_cuid, max_length=36, primary_key=True, serialize=False)),
                ('provider', models.CharField(max_length=32)),
                ('access_token', models.TextField(db_column='accessToken')),
                ('refresh_token', models.TextField(blank=True, db_column='refreshToken', null=True)),
                ('cloud_id', models.CharField(blank=True, db_column='cloudId', max_length=128, null=True)),
                ('site_url', models.URLField(blank=True, db_column='siteUrl', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_column='createdAt')),
                ('updated_at', models.DateTimeField(auto_now=True, db_column='updatedAt')),
                ('repo', models.ForeignKey(db_column='repoId', on_delete=django.db.models.deletion.CASCADE, related_name='integrations', to='repos.repo')),
                ('user', models.ForeignKey(db_column='userId', on_delete=django.db.models.deletion.CASCADE, related_name='integrations', to='repos.user')),
            ],
            options={
                'db_table': 'Integration',
                'unique_together': {('user', 'repo', 'provider')},
            },
        ),
    ]
