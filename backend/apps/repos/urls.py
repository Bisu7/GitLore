from django.urls import path
from .views import (
    repos_available, repos_connected, repos_connect,
    repo_status, commit_detail, commit_explain,
)

urlpatterns = [
    path('repos/available', repos_available),
    path('repos/connected', repos_connected),
    path('repos/connect', repos_connect),
    path('repos/<str:repo_id>/status', repo_status),
    path('commits/<str:sha>', commit_detail),
    path('commits/<str:sha>/explain', commit_explain),
]
