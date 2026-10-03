import os
from datetime import datetime, timezone, timedelta
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from lib.cache import get_redis
from lib.neo4j_client import get_driver
from apps.repos.models import User, Repo, QueryLog


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    GET /health
    Returns: { status: "ok"|"degraded", db: "connected"|"error", redis: "connected"|"error", neo4j: "connected"|"error", timestamp }
    """
    db_status = 'error'
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            row = cursor.fetchone()
            if row and row[0] == 1:
                db_status = 'connected'
    except Exception as e:
        db_status = 'error'

    redis_status = 'error'
    try:
        r = get_redis()
        if r and r.ping():
            redis_status = 'connected'
    except Exception:
        redis_status = 'error'

    neo4j_status = 'error'
    try:
        driver = get_driver()
        if driver:
            driver.verify_connectivity()
            neo4j_status = 'connected'
    except Exception:
        neo4j_status = 'error'

    overall = "ok" if (db_status == 'connected' or redis_status == 'connected') else "degraded"
    # Even if offline locally, standard return:
    return JsonResponse({
        'status': overall,
        'db': db_status,
        'redis': redis_status,
        'neo4j': neo4j_status,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_stats(request):
    """
    GET /admin/stats
    Admin-only, requires ADMIN_SECRET header matching settings.ADMIN_SECRET.
    Returns: total users, total repos, total queries today/week/month, top 10 questions asked.
    """
    secret_header = (
        request.META.get('HTTP_ADMIN_SECRET') or
        request.META.get('HTTP_X_ADMIN_SECRET') or
        request.headers.get('Admin-Secret') or
        request.headers.get('X-Admin-Secret')
    )
    expected_secret = getattr(settings, 'ADMIN_SECRET', 'gitlore-admin-secret-dev')

    if not secret_header or secret_header != expected_secret:
        return JsonResponse({'error': 'Unauthorized. Invalid ADMIN_SECRET.'}, status=403)

    now = datetime.now(timezone.utc)
    today_start = now - timedelta(days=1)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    total_users = User.objects.count()
    total_repos = Repo.objects.filter(is_demo=False).count()

    queries_today = QueryLog.objects.filter(created_at__gte=today_start).count()
    queries_week = QueryLog.objects.filter(created_at__gte=week_start).count()
    queries_month = QueryLog.objects.filter(created_at__gte=month_start).count()

    top_questions = list(
        QueryLog.objects
        .order_by('-created_at')
        .values('question', 'repo__full_name', 'response_time_ms', 'created_at')[:10]
    )

    return JsonResponse({
        'totalUsers': total_users,
        'totalRepos': total_repos,
        'queriesToday': queries_today,
        'queriesWeek': queries_week,
        'queriesMonth': queries_month,
        'topQuestions': [
            {
                'question': q['question'],
                'repo': q['repo__full_name'],
                'responseTimeMs': q['response_time_ms'],
                'createdAt': q['created_at'].isoformat() if q['created_at'] else None
            } for q in top_questions
        ]
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def sentry_debug(request):
    """Test endpoint to trigger a Sentry event to verify Sentry configuration."""
    try:
        import sentry_sdk
        sentry_sdk.capture_message("Test Sentry event from GitLore backend", level="info")
    except Exception as e:
        return JsonResponse({'status': 'sentry_not_available', 'error': str(e)})
    return JsonResponse({'status': 'sentry_event_triggered'})
