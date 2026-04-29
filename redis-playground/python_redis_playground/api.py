import logging
import time

from fastapi import FastAPI, Query
import redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("redis-playground")

app = FastAPI(
    title="Redis + FastAPI Playground",
    description=(
        "Explore Redis features hands-on.\n\n"
        "## Scenarios\n"
        "- **Strings** – basic key/value get & set\n"
        "- **Leaderboard** – sorted sets for real-time ranking\n"
        "- **Rate Limiter** – fixed-window request throttling\n"
        "- **Distributed Lock** – mutual exclusion with SET NX EX\n"
    ),
    version="1.0.0",
)

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# ---------------------------------------------------------------------------
# Strings
# ---------------------------------------------------------------------------

@app.post("/set/{key}", tags=["Strings"])
def set_key(key: str, value: str = Query(..., description="Value to store")):
    """Saves a string value into Redis."""
    r.set(key, value)
    logger.info("SET key='%s' value='%s'", key, value)
    return {"message": f"Successfully set '{key}' to '{value}'"}


@app.get("/get/{key}", tags=["Strings"])
def get_key(key: str):
    """Retrieves a string value from Redis."""
    val = r.get(key)
    if val is None:
        logger.warning("GET key='%s' -> not found", key)
        return {"error": "Key not found!"}
    logger.info("GET key='%s' -> '%s'", key, val)
    return {"key": key, "value": val}


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

LEADERBOARD_KEY = "game:leaderboard"


@app.post("/leaderboard/add", tags=["Leaderboard"])
def add_score(
    player: str = Query(..., description="Player name"),
    score: int = Query(..., description="Score to set for the player"),
):
    """Adds or updates a player score in the leaderboard sorted set."""
    r.zadd(LEADERBOARD_KEY, {player: score})
    rank = r.zrevrank(LEADERBOARD_KEY, player)
    logger.info("LEADERBOARD add player='%s' score=%d rank=#%d", player, score, rank + 1)
    return {"message": f"Added {player} with {score} points", "rank": rank + 1}


@app.get("/leaderboard/top", tags=["Leaderboard"])
def get_top_players(
    count: int = Query(default=3, ge=1, description="Number of top players to return"),
):
    """Gets the top N players ordered by score descending."""
    top = r.zrevrange(LEADERBOARD_KEY, 0, count - 1, withscores=True)
    results = [{"rank": i + 1, "player": p, "score": int(s)} for i, (p, s) in enumerate(top)]
    logger.info("LEADERBOARD top-%d -> %s", count, [(x["player"], x["score"]) for x in results])
    return {"top_players": results}


@app.get("/leaderboard/rank/{player}", tags=["Leaderboard"])
def get_player_rank(player: str):
    """Gets a specific player's rank and score."""
    rank = r.zrevrank(LEADERBOARD_KEY, player)
    score = r.zscore(LEADERBOARD_KEY, player)
    if rank is None:
        logger.warning("LEADERBOARD rank player='%s' -> not found", player)
        return {"error": f"Player '{player}' not found in leaderboard"}
    logger.info("LEADERBOARD rank player='%s' rank=#%d score=%d", player, rank + 1, int(score))
    return {"player": player, "rank": rank + 1, "score": int(score)}


@app.get("/leaderboard/all", tags=["Leaderboard"])
def get_all_players():
    """Returns every player with their rank and score."""
    all_players = r.zrevrange(LEADERBOARD_KEY, 0, -1, withscores=True)
    results = [{"rank": i + 1, "player": p, "score": int(s)} for i, (p, s) in enumerate(all_players)]
    logger.info("LEADERBOARD all -> %d players", len(results))
    return {"players": results, "total": len(results)}


@app.delete("/leaderboard/reset", tags=["Leaderboard"])
def reset_leaderboard():
    """Clears the entire leaderboard."""
    r.delete(LEADERBOARD_KEY)
    logger.info("LEADERBOARD reset")
    return {"message": "Leaderboard cleared"}


# ---------------------------------------------------------------------------
# Rate Limiter
# ---------------------------------------------------------------------------

@app.post("/rate-limiter/check", tags=["Rate Limiter"])
def check_rate_limit(
    user_id: str = Query(..., description="User or client identifier"),
    action: str = Query(default="default", description="Action being rate-limited"),
    limit: int = Query(default=5, ge=1, description="Max requests allowed per window"),
    window_seconds: int = Query(default=60, ge=1, description="Time window length in seconds"),
):
    """
    Fixed-window rate limiter.

    Increments the request counter for the given `user_id` + `action` in the
    current time window.  Returns `allowed: false` once the counter exceeds
    `limit`.  The counter key expires automatically at the end of the window.

    **Try it:** call this endpoint repeatedly with the same `user_id` and watch
    `current_count` climb until `allowed` flips to `false`.
    """
    window = int(time.time()) // window_seconds
    key = f"rate_limit:{user_id}:{action}:{window}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, window_seconds)
    ttl = r.ttl(key)
    allowed = count <= limit
    remaining = max(0, limit - count)
    logger.info(
        "RATE_LIMIT check user='%s' action='%s' count=%d/%d allowed=%s ttl=%ds",
        user_id, action, count, limit, allowed, ttl,
    )
    return {
        "allowed": allowed,
        "user_id": user_id,
        "action": action,
        "current_count": count,
        "limit": limit,
        "remaining": remaining,
        "window_resets_in_seconds": ttl,
    }


@app.get("/rate-limiter/status", tags=["Rate Limiter"])
def get_rate_limit_status(
    user_id: str = Query(..., description="User or client identifier"),
    action: str = Query(default="default", description="Action being rate-limited"),
    limit: int = Query(default=5, ge=1, description="Max requests allowed per window"),
    window_seconds: int = Query(default=60, ge=1, description="Time window length in seconds"),
):
    """Checks current rate limit usage for a user+action without consuming a slot."""
    window = int(time.time()) // window_seconds
    key = f"rate_limit:{user_id}:{action}:{window}"
    raw = r.get(key)
    count = int(raw) if raw else 0
    ttl = r.ttl(key) if raw else window_seconds
    remaining = max(0, limit - count)
    logger.info(
        "RATE_LIMIT status user='%s' action='%s' count=%d/%d",
        user_id, action, count, limit,
    )
    return {
        "user_id": user_id,
        "action": action,
        "current_count": count,
        "limit": limit,
        "remaining": remaining,
        "window_resets_in_seconds": ttl,
    }


@app.delete("/rate-limiter/reset", tags=["Rate Limiter"])
def reset_rate_limit(
    user_id: str = Query(..., description="User or client identifier"),
    action: str = Query(default="default", description="Action to reset"),
):
    """Resets all rate-limit counters for a user+action across all windows."""
    pattern = f"rate_limit:{user_id}:{action}:*"
    keys = r.keys(pattern)
    if keys:
        r.delete(*keys)
    logger.info(
        "RATE_LIMIT reset user='%s' action='%s' cleared=%d keys",
        user_id, action, len(keys),
    )
    return {
        "message": f"Rate limit cleared for user '{user_id}' action '{action}'",
        "keys_deleted": len(keys),
    }


# ---------------------------------------------------------------------------
# Distributed Lock
# ---------------------------------------------------------------------------

@app.post("/lock/acquire", tags=["Distributed Lock"])
def acquire_lock(
    lock_name: str = Query(..., description="Name of the shared resource to lock"),
    holder: str = Query(..., description="Unique identifier of the lock requester (e.g. worker-1)"),
    ttl_seconds: int = Query(default=30, ge=1, description="Auto-release timeout in seconds"),
):
    """
    Acquires a distributed lock using Redis `SET key value NX EX`.

    - If no one holds the lock, it is granted to `holder` and expires after
      `ttl_seconds` (safety net against crashed holders).
    - If the lock is already taken, `acquired` is `false` and `current_holder`
      shows who owns it.

    **Try it:** acquire with `worker-1`, then try again with `worker-2` to see
    contention in action.
    """
    key = f"lock:{lock_name}"
    acquired = r.set(key, holder, nx=True, ex=ttl_seconds) is not None
    ttl = r.ttl(key)
    current_holder = r.get(key)
    logger.info(
        "LOCK acquire name='%s' holder='%s' acquired=%s current_holder='%s' ttl=%ds",
        lock_name, holder, acquired, current_holder, ttl,
    )
    return {
        "acquired": acquired,
        "lock_name": lock_name,
        "requested_by": holder,
        "current_holder": current_holder,
        "ttl_seconds": ttl,
        "message": (
            f"Lock '{lock_name}' acquired by '{holder}'"
            if acquired
            else f"Lock already held by '{current_holder}'"
        ),
    }


@app.delete("/lock/release", tags=["Distributed Lock"])
def release_lock(
    lock_name: str = Query(..., description="Name of the lock to release"),
    holder: str = Query(..., description="Must match the current lock holder"),
):
    """
    Releases a lock only when `holder` matches the current owner.

    This prevents a slow worker from accidentally releasing a lock that was
    re-acquired by someone else after the original TTL expired.
    """
    key = f"lock:{lock_name}"
    current_holder = r.get(key)
    if current_holder is None:
        logger.warning("LOCK release name='%s' holder='%s' -> lock not found", lock_name, holder)
        return {"released": False, "message": f"Lock '{lock_name}' does not exist or has already expired"}
    if current_holder != holder:
        logger.warning(
            "LOCK release name='%s' holder='%s' -> denied, held by '%s'",
            lock_name, holder, current_holder,
        )
        return {
            "released": False,
            "message": f"Cannot release: lock held by '{current_holder}', not '{holder}'",
        }
    r.delete(key)
    logger.info("LOCK release name='%s' holder='%s' -> released", lock_name, holder)
    return {"released": True, "lock_name": lock_name, "message": f"Lock '{lock_name}' released by '{holder}'"}


@app.get("/lock/status", tags=["Distributed Lock"])
def get_lock_status(
    lock_name: str = Query(..., description="Name of the lock to inspect"),
):
    """Returns whether a lock is currently held, who holds it, and the remaining TTL."""
    key = f"lock:{lock_name}"
    holder = r.get(key)
    ttl = r.ttl(key)
    is_locked = holder is not None
    logger.info(
        "LOCK status name='%s' is_locked=%s holder='%s' ttl=%ds",
        lock_name, is_locked, holder, ttl,
    )
    return {
        "lock_name": lock_name,
        "is_locked": is_locked,
        "current_holder": holder,
        "ttl_seconds": ttl if is_locked else None,
    }
