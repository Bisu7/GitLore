import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('JWT_SECRET', 'django-insecure-fallback-key')
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'apps.repos',
    'apps.auth_app',
    'apps.search',
    'apps.integrations',
    'pgvector.django',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'gitlore.urls'
WSGI_APPLICATION = 'gitlore.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'codebase_time_machine',
        'USER': 'postgres',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': '5433',
    }
}

# Parse DATABASE_URL if provided
_db_url = os.getenv('DATABASE_URL', '')
if _db_url:
    import re
    m = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', _db_url)
    if m:
        DATABASES['default']['USER'] = m.group(1)
        DATABASES['default']['PASSWORD'] = m.group(2)
        DATABASES['default']['HOST'] = m.group(3)
        DATABASES['default']['PORT'] = m.group(4)
        DATABASES['default']['NAME'] = m.group(5).split('?')[0]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True

# CORS - allow frontend
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    os.getenv('FRONTEND_URL', 'http://localhost:3000'),
]
CORS_ALLOW_ALL_ORIGINS = DEBUG

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.auth_app.authentication.CookieJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# SimpleJWT
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'id',
}

# Celery
CELERY_BROKER_URL = 'redis://127.0.0.1:6379/0'
CELERY_RESULT_BACKEND = 'redis://127.0.0.1:6379/0'
CELERY_TASK_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']

# Environment
GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET', '')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
NEO4J_URI = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
NEO4J_USERNAME = os.getenv('NEO4J_USERNAME', 'neo4j')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', 'password')
JIRA_CLIENT_ID = os.getenv('JIRA_CLIENT_ID', '')
JIRA_CLIENT_SECRET = os.getenv('JIRA_CLIENT_SECRET', '')
JIRA_REDIRECT_URI = os.getenv('JIRA_REDIRECT_URI', 'http://localhost:8080/integrations/jira/callback')
LINEAR_CLIENT_ID = os.getenv('LINEAR_CLIENT_ID', '')
LINEAR_CLIENT_SECRET = os.getenv('LINEAR_CLIENT_SECRET', '')
LINEAR_REDIRECT_URI = os.getenv('LINEAR_REDIRECT_URI', 'http://localhost:8080/integrations/linear/callback')
FERNET_KEY = os.getenv('FERNET_KEY', '')

REPOS_TMP_DIR = BASE_DIR / 'tmp' / 'repos'
