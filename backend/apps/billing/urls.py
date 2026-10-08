from django.urls import path
from .views import (
    create_checkout,
    billing_portal,
    stripe_webhook,
    subscription_status,
)

urlpatterns = [
    path('billing/create-checkout', create_checkout),
    path('billing/portal', billing_portal),
    path('billing/webhook', stripe_webhook),
    path('billing/subscription', subscription_status),
]
