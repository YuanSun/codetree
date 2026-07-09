"""
Redis for Rate Limiting — three algorithms, same job, different tradeoffs.

Run:
    python3 rate_limit_lab.py fixed-window
    python3 rate_limit_lab.py sliding-window
    python3 rate_limit_lab.py token-bucket
    python3 rate_limit_lab.py compare      # same burst pattern through all three
"""
import argparse
import time

import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

LIMIT = 5
WINDOW_SECONDS = 4


def fixed_window_allow(user: str) -> dict:
    """Simple counter per time bucket. Fast, but allows 2x burst at window boundaries."""
    window = int(time.time()) // WINDOW_SECONDS
    key = f"ratelimit:fixed:{user}:{window}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, WINDOW_SECONDS)
    return {"allowed": count <= LIMIT, "count": count}


_SLIDING_WINDOW_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call("ZREMRANGEBYSCORE", key, 0, now - window_ms)
local count = redis.call("ZCARD", key)
if count < limit then
    redis.call("ZADD", key, now, now .. "-" .. math.random())
    redis.call("PEXPIRE", key, window_ms)
    return {1, count + 1}
else
    return {0, count}
end
"""
_sliding_window_script = r.register_script(_SLIDING_WINDOW_SCRIPT)


def sliding_window_allow(user: str) -> dict:
    """
    ZSET of request timestamps. Evicts anything older than the window on
    every call, so the limit applies to *any* rolling window, not just
    fixed clock-aligned buckets. No boundary-burst problem.
    """
    key = f"ratelimit:sliding:{user}"
    now_ms = int(time.time() * 1000)
    allowed, count = _sliding_window_script(keys=[key], args=[now_ms, WINDOW_SECONDS * 1000, LIMIT])
    return {"allowed": bool(allowed), "count": count}


_TOKEN_BUCKET_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])  -- tokens per second

local bucket = redis.call("HMGET", key, "tokens", "updated_at")
local tokens = tonumber(bucket[1])
local updated_at = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    updated_at = now
end

local elapsed = math.max(0, now - updated_at)
tokens = math.min(capacity, tokens + elapsed * refill_rate)

local allowed = 0
if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
end

redis.call("HSET", key, "tokens", tokens, "updated_at", now)
redis.call("EXPIRE", key, 60)
return {allowed, tostring(tokens)}
"""
_token_bucket_script = r.register_script(_TOKEN_BUCKET_SCRIPT)


def token_bucket_allow(user: str, capacity: int = LIMIT, refill_rate: float = LIMIT / WINDOW_SECONDS) -> dict:
    """
    Bucket refills continuously at `refill_rate` tokens/sec, up to `capacity`.
    Smooths traffic instead of hard-resetting every window; allows short
    bursts as long as tokens have accumulated.
    """
    key = f"ratelimit:bucket:{user}"
    now = time.time()
    allowed, tokens_left = _token_bucket_script(keys=[key], args=[now, capacity, refill_rate])
    return {"allowed": bool(allowed), "tokens_left": round(float(tokens_left), 2)}


def _cleanup(user: str):
    r.delete(f"ratelimit:fixed:{user}:{int(time.time()) // WINDOW_SECONDS}")
    r.delete(f"ratelimit:sliding:{user}")
    r.delete(f"ratelimit:bucket:{user}")


def run_burst(label: str, allow_fn, user: str, n: int = 12, delay: float = 0.15):
    print(f"--- {label} (limit={LIMIT} per {WINDOW_SECONDS}s) ---")
    for i in range(n):
        result = allow_fn(user)
        status = "ALLOWED" if result["allowed"] else "BLOCKED"
        extra = {k: v for k, v in result.items() if k != "allowed"}
        print(f"  req {i + 1:>2}: [{status}] {extra}")
        time.sleep(delay)
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["fixed-window", "sliding-window", "token-bucket", "compare"])
    parser.add_argument("--requests", type=int, default=12)
    parser.add_argument("--delay", type=float, default=0.15, help="seconds between simulated requests")
    args = parser.parse_args()

    r.ping()
    user = "user:alice"
    _cleanup(user)

    if args.mode == "fixed-window":
        run_burst("Fixed Window", fixed_window_allow, user, args.requests, args.delay)
    elif args.mode == "sliding-window":
        run_burst("Sliding Window Log", sliding_window_allow, user, args.requests, args.delay)
    elif args.mode == "token-bucket":
        run_burst("Token Bucket", token_bucket_allow, user, args.requests, args.delay)
    else:
        run_burst("Fixed Window", fixed_window_allow, user, args.requests, args.delay)
        _cleanup(user)
        run_burst("Sliding Window Log", sliding_window_allow, user, args.requests, args.delay)
        _cleanup(user)
        run_burst("Token Bucket", token_bucket_allow, user, args.requests, args.delay)

    _cleanup(user)
