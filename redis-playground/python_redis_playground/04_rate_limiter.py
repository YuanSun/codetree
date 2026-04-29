import redis
import time

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

RATE_LIMIT = 5
WINDOW_SECONDS = 10


def check_rate_limit(user_id: str) -> dict:
    window = int(time.time()) // WINDOW_SECONDS
    key = f"rate_limit:{user_id}:default:{window}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, WINDOW_SECONDS)
    ttl = r.ttl(key)
    allowed = count <= RATE_LIMIT
    return {"allowed": allowed, "count": count, "limit": RATE_LIMIT, "ttl": ttl, "key": key}


print("--- Rate Limiter (Fixed Window) ---")
print(f"Limit: {RATE_LIMIT} requests per {WINDOW_SECONDS} seconds\n")

user = "user:alice"
print(f"Simulating 7 requests from '{user}':")
last_key = None
for i in range(7):
    result = check_rate_limit(user)
    status = "ALLOWED" if result["allowed"] else "BLOCKED"
    last_key = result["key"]
    print(f"  Request {i+1}: [{status}] count={result['count']}/{result['limit']} window_resets_in={result['ttl']}s")

# Clean up
if last_key:
    r.delete(last_key)
print("\nCleaned up Redis keys.")
