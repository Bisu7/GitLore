import os
import json
import hashlib
import redis

REDIS_URL = os.getenv('REDIS_URL', os.getenv('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/1'))

try:
    _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
except Exception:
    _redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        except Exception:
            return None
    return _redis_client


def make_key(prefix: str, repo_id: str, extra: str = '') -> str:
    """Generates a stable cache key with a SHA256 digest of parameters."""
    raw = f"{prefix}:{repo_id}:{extra}"
    hashed = hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]
    return f"gitlore:{prefix}:{repo_id}:{hashed}"


def get_cached(key: str):
    """Retrieve JSON-deserialized value from cache."""
    r = get_redis()
    if not r:
        return None
    try:
        val = r.get(key)
        if val:
            return json.loads(val)
    except Exception as e:
        print(f"[Cache GET error for {key}]: {e}")
    return None


def set_cached(key: str, data, ttl_seconds: int):
    """Store JSON-serialized value into cache with TTL."""
    r = get_redis()
    if not r:
        return False
    try:
        r.setex(key, ttl_seconds, json.dumps(data))
        return True
    except Exception as e:
        print(f"[Cache SET error for {key}]: {e}")
        return False


def invalidate_repo_cache(repo_id: str):
    """
    Invalidates all cached search, timeline, and drift keys for a given repo.
    Called when a new sync/ingestion completes.
    """
    r = get_redis()
    if not r:
        return 0
    try:
        patterns = [
            f"gitlore:search:{repo_id}:*",
            f"gitlore:timeline:{repo_id}:*",
            f"gitlore:drift:{repo_id}:*",
        ]
        count = 0
        for pattern in patterns:
            keys = r.keys(pattern)
            if keys:
                r.delete(*keys)
                count += len(keys)
        print(f"[Cache Invalidate]: Cleared {count} cache keys for repo {repo_id}")
        return count
    except Exception as e:
        print(f"[Cache Invalidate error for {repo_id}]: {e}")
        return 0
