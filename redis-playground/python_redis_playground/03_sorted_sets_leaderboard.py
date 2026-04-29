import redis

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

LEADERBOARD_KEY = 'game:leaderboard'

print("--- Sorted Sets (Leaderboards) ---")

# Add scores (Redis automatically sorts them!)
print("Adding scores...")
r.zadd(LEADERBOARD_KEY, {'Yuan': 1500, 'Alex': 800, 'Sam': 2200, 'Taylor': 1800})

# Get the top 3 players (descending order)
top_players = r.zrevrange(LEADERBOARD_KEY, 0, 2, withscores=True)
print("\nTop 3 Players:")
for rank, (player, score) in enumerate(top_players, 1):
    print(f"#{rank} - {player}: {score} points")

# Get a specific player's rank (0-indexed, so we add 1)
yuan_rank = r.zrevrank(LEADERBOARD_KEY, 'Yuan')
if yuan_rank is not None:
    print(f"\nYuan's Rank: #{yuan_rank + 1}")

# Clean up
r.delete(LEADERBOARD_KEY)
