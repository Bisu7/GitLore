import os
import json
from datetime import datetime, timezone
import stripe
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.repos.models import Subscription, User, Repo, UsageRecord
from lib.plan_limits import get_user_plan

stripe.api_key = os.getenv('STRIPE_SECRET_KEY', 'sk_test_mock_stripe_key')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout(request):
    """
    POST /billing/create-checkout
    Body: { plan: 'PRO' | 'TEAM' }
    Returns: { url: session.url }
    """
    plan = request.data.get('plan', 'PRO').upper()
    if plan not in ['PRO', 'TEAM']:
        return Response({'error': 'Invalid plan. Choose PRO or TEAM.'}, status=400)

    user = request.user
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')

    price_cents = 2900 if plan == 'PRO' else 19900
    plan_name = f"GitLore {plan} Plan"

    # Get or create Stripe customer
    sub = Subscription.objects.filter(user=user).order_by('-created_at').first()
    customer_id = sub.stripe_customer_id if sub and sub.stripe_customer_id else None

    if not customer_id and stripe.api_key and not stripe.api_key.startswith('sk_test_mock'):
        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.name or user.email,
                metadata={'userId': user.id}
            )
            customer_id = customer.id
            if sub:
                sub.stripe_customer_id = customer_id
                sub.save(update_fields=['stripe_customer_id'])
            else:
                Subscription.objects.create(
                    user=user,
                    stripe_customer_id=customer_id,
                    plan='FREE',
                    status='active'
                )
        except Exception as e:
            print(f"[Stripe Customer Create Error]: {e}")

    try:
        # If real Stripe key is configured, create live Checkout Session
        if stripe.api_key and not stripe.api_key.startswith('sk_test_mock'):
            session_kwargs = {
                'payment_method_types': ['card'],
                'mode': 'subscription',
                'line_items': [{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': plan_name,
                            'description': f'Full GitLore access with {plan} features.',
                        },
                        'unit_amount': price_cents,
                        'recurring': {'interval': 'month'},
                    },
                    'quantity': 1,
                }],
                'metadata': {
                    'userId': user.id,
                    'plan': plan,
                },
                'success_url': f"{frontend_url}/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
                'cancel_url': f"{frontend_url}/billing?canceled=true",
            }
            if customer_id:
                session_kwargs['customer'] = customer_id
            else:
                session_kwargs['customer_email'] = user.email

            checkout_session = stripe.checkout.Session.create(**session_kwargs)
            return Response({'url': checkout_session.url, 'checkoutUrl': checkout_session.url})
        else:
            # Mock mode for testing without external Stripe credentials
            mock_url = f"{frontend_url}/billing?mock_checkout=true&plan={plan}"
            return Response({'url': mock_url, 'checkoutUrl': mock_url})
    except Exception as e:
        return Response({'error': f'Failed to create Stripe checkout session: {str(e)}'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_portal(request):
    """
    GET /billing/portal
    Returns: { url: portal_session.url }
    """
    user = request.user
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')

    sub = Subscription.objects.filter(user=user).order_by('-created_at').first()
    customer_id = sub.stripe_customer_id if sub else None

    if not customer_id or stripe.api_key.startswith('sk_test_mock'):
        return Response({'url': f"{frontend_url}/billing?portal=mock"})

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{frontend_url}/billing"
        )
        return Response({'url': portal_session.url})
    except Exception as e:
        return Response({'error': f'Failed to create portal session: {str(e)}'}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """
    POST /billing/webhook
    Handles Stripe webhooks:
    - checkout.session.completed -> create/update Subscription record
    - customer.subscription.updated -> update plan
    - customer.subscription.deleted -> downgrade to FREE
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

    event = None
    if STRIPE_WEBHOOK_SECRET and sig_header:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError:
            return HttpResponse(status=400)
    else:
        try:
            event = json.loads(payload.decode('utf-8'))
        except Exception:
            return HttpResponse(status=400)

    event_type = event.get('type')
    data_object = event.get('data', {}).get('object', {})

    if event_type == 'checkout.session.completed':
        user_id = data_object.get('metadata', {}).get('userId')
        plan = data_object.get('metadata', {}).get('plan', 'PRO')
        customer_id = data_object.get('customer')
        subscription_id = data_object.get('subscription')

        if user_id:
            try:
                user = User.objects.get(id=user_id)
                Subscription.objects.update_or_create(
                    user=user,
                    defaults={
                        'stripe_customer_id': customer_id,
                        'stripe_subscription_id': subscription_id,
                        'plan': plan,
                        'status': 'active',
                    }
                )
            except User.DoesNotExist:
                pass

    elif event_type == 'customer.subscription.updated':
        subscription_id = data_object.get('id')
        status = data_object.get('status', 'active')
        current_period_end_timestamp = data_object.get('current_period_end')
        period_end = (
            datetime.fromtimestamp(current_period_end_timestamp, tz=timezone.utc)
            if current_period_end_timestamp else None
        )

        sub = Subscription.objects.filter(stripe_subscription_id=subscription_id).first()
        if sub:
            sub.status = status
            if period_end:
                sub.current_period_end = period_end
            sub.save()

    elif event_type == 'customer.subscription.deleted':
        subscription_id = data_object.get('id')
        sub = Subscription.objects.filter(stripe_subscription_id=subscription_id).first()
        if sub:
            sub.plan = 'FREE'
            sub.status = 'canceled'
            sub.save()

    return JsonResponse({'received': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def subscription_status(request):
    """
    GET /billing/subscription
    Returns current plan, subscription details, and usage metrics.
    """
    user = request.user
    plan = get_user_plan(user)
    sub = Subscription.objects.filter(user=user).order_by('-created_at').first()

    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    repo_count = Repo.objects.filter(user=user, is_demo=False).count()
    query_count = UsageRecord.objects.filter(
        user=user,
        event_type='QUERY',
        created_at__gte=start_of_month
    ).count()

    return Response({
        'plan': plan,
        'status': sub.status if sub else 'active',
        'currentPeriodEnd': sub.current_period_end if sub else None,
        'stripeCustomerId': sub.stripe_customer_id if sub else None,
        'hasSubscription': bool(sub and sub.stripe_subscription_id),
        'usage': {
            'repoCount': repo_count,
            'maxRepos': 1 if plan == 'FREE' else (10 if plan == 'PRO' else None),
            'queryCount': query_count,
            'maxQueries': 50 if plan == 'FREE' else None,
        }
    })
