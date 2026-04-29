import redis

# Connect to local Redis (defaults to localhost:6379)
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

print("--- Basic Key/Value ---")
r.set('my_key', 'Hello Python Redis!')
value = r.get('my_key')
print(f"Got value for 'my_key': {value}")

print("\n--- Hashes (Dictionaries) ---")
# Hashes are great for storing objects like user profiles
user_profile = {
    'name': 'Alice',
    'email': 'alice@example.com',
    'age': '28'
}
r.hset('user:1001', mapping=user_profile)

# Get all fields for the user
saved_profile = r.hgetall('user:1001')
print(f"Saved Profile: {saved_profile}")

# Get a specific field
email = r.hget('user:1001', 'email')
print(f"User Email: {email}")
