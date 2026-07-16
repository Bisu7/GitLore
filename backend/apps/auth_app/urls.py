from django.urls import path
from .views import GitHubConnectView, GitHubCallbackView

urlpatterns = [
    path('auth/github', GitHubConnectView.as_view()),
    path('auth/github/callback', GitHubCallbackView.as_view()),
]
