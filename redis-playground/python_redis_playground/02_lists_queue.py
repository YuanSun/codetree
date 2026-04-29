import redis

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

QUEUE_KEY = 'task_queue'

print("--- Lists as Queues (FIFO) ---")

# Push items to the right of the list
print("Pushing tasks to queue...")
r.rpush(QUEUE_KEY, 'Task A')
r.rpush(QUEUE_KEY, 'Task B')
r.rpush(QUEUE_KEY, 'Task C')

# View the whole queue
queue_contents = r.lrange(QUEUE_KEY, 0, -1)
print(f"Current Queue: {queue_contents}")

# Pop an item from the left (FIFO)
popped_task = r.lpop(QUEUE_KEY)
print(f"Popped task: {popped_task}")

# View the queue after popping
remaining_queue = r.lrange(QUEUE_KEY, 0, -1)
print(f"Queue after pop: {remaining_queue}")

# Clean up queue
r.delete(QUEUE_KEY)
