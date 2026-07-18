from django.urls import path
from .views import (
    jira_connect, JiraCallbackView,
    linear_connect, LinearCallbackView,
    integrations_status, tickets_count,
)

urlpatterns = [
    path('integrations/jira/connect', jira_connect),
    path('integrations/jira/callback', JiraCallbackView.as_view()),
    path('integrations/linear/connect', linear_connect),
    path('integrations/linear/callback', LinearCallbackView.as_view()),
    path('repos/<str:repo_id>/integrations', integrations_status),
    path('repos/<str:repo_id>/tickets/count', tickets_count),
]
