from fastapi import FastAPI
import redis

app = FastAPI(title="Redis + FastAPI Playground")

# Connect to Redis
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

@app.post("/set/{key}")
def set_key(key: str, value: str):
    """Saves a string value into Redis"""
    r.set(key, value)
    return {"message": f"Successfully set '{key}' to '{value}'"}

@app.get("/get/{key}")
def get_key(key: str):
    """Retrieves a string value from Redis"""
    val = r.get(key)
    if val is None:
        return {"error": "Key not found!"}
    return {"key": key, "value": val}

@app.post("/leaderboard/add")
def add_score(player: str, score: int):
    """Adds a player to a Redis Sorted Set leaderboard"""
    r.zadd("game:leaderboard", {player: score})
    return {"message": f"Added {player} with {score} points"}

@app.get("/leaderboard/top")
def get_top_players(count: int = 3):
    """Gets the top N players from the leaderboard"""
    # zrevrange gets the highest scores first
    top_players = r.zrevrange("game:leaderboard", 0, count - 1, withscores=True)
    
    # Format the output into a nice list of dictionaries
    results = [{"rank": i+1, "player": p, "score": s} for i, (p, s) in enumerate(top_players)]
    return {"top_players": results}
