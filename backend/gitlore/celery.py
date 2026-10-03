import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gitlore.settings')

app = Celery('gitlore')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks(['embeddings', 'ingestion', 'graph', 'apps.repos'])
