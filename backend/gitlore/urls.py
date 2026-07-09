from django.urls import path, include

urlpatterns = [
    path('', include('apps.auth_app.urls')),
    path('', include('apps.repos.urls')),
    path('', include('apps.search.urls')),
    path('', include('apps.integrations.urls')),
]
