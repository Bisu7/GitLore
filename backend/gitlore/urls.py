from django.urls import path, include
from .health import health_check, admin_stats, sentry_debug

urlpatterns = [
    path('health', health_check),
    path('admin/stats', admin_stats),
    path('sentry-debug', sentry_debug),
    path('', include('apps.auth_app.urls')),
    path('', include('apps.repos.urls')),
    path('', include('apps.search.urls')),
    path('', include('apps.integrations.urls')),
    path('', include('apps.billing.urls')),
]
