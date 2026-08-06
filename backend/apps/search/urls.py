from django.urls import path
from .views import search, search_answer

urlpatterns = [
    path('search', search),
    path('search/answer', search_answer),
]
