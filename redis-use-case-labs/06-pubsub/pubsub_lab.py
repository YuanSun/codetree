"""
Redis for Pub/Sub — fire-and-forget messaging, and why it's not durable.

Run in two terminals for the interactive demo:
    python3 pubsub_lab.py subscribe --channel chat:general
    python3 pubsub_lab.py publish --channel chat:general

Or run the automated demos in one terminal:
    python3 pubsub_lab.py loss-demo       # messages published before a subscriber exists vanish
    python3 pubsub_lab.py pattern-demo    # PSUBSCRIBE across multiple channels at once
"""
import argparse
import threading
import time

import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)


def subscribe(channel: str, seconds: float | None = None):
    pubsub = r.pubsub()
    pubsub.subscribe(channel)
    print(f"Subscribed to '{channel}'. Waiting for messages (Ctrl+C to stop)...\n")

    deadline = time.time() + seconds if seconds else None
    try:
        while deadline is None or time.time() < deadline:
            message = pubsub.get_message(timeout=0.5)
            if message and message["type"] == "message":
                print(f"  received on {message['channel']}: {message['data']}")
    except KeyboardInterrupt:
        pass
    finally:
        pubsub.close()


def publish_interactive(channel: str):
    print(f"Publishing to '{channel}'. Type a message and press enter (Ctrl+C to quit).")
    print("Note: if no subscriber is connected right now, your message is simply dropped.\n")
    try:
        while True:
            text = input("> ")
            receivers = r.publish(channel, text)
            print(f"  delivered to {receivers} subscriber(s)")
    except (KeyboardInterrupt, EOFError):
        pass


def demo_loss(channel: str = "chat:demo"):
    print(f"1. Publishing 3 messages to '{channel}' with NO subscriber connected yet...")
    for i in range(3):
        receivers = r.publish(channel, f"early message {i + 1}")
        print(f"   published 'early message {i + 1}' -> delivered to {receivers} subscriber(s)")

    print("\n2. NOW a subscriber connects...")
    received = []
    stop = threading.Event()
    pubsub = r.pubsub()
    pubsub.subscribe(channel)
    pubsub.get_message(timeout=1)  # consume the subscribe confirmation

    def listener():
        while not stop.is_set():
            message = pubsub.get_message(timeout=0.1)
            if message and message["type"] == "message":
                received.append(message["data"])

    t = threading.Thread(target=listener)
    t.start()
    time.sleep(0.3)

    print("3. Publishing 3 more messages now that a subscriber IS connected...")
    for i in range(3):
        receivers = r.publish(channel, f"late message {i + 1}")
        print(f"   published 'late message {i + 1}' -> delivered to {receivers} subscriber(s)")

    time.sleep(0.3)
    stop.set()
    t.join()
    pubsub.close()

    print(f"\nMessages the subscriber actually received: {received}")
    print("^ The 3 'early' messages are gone forever — PUBLISH never persists anything.")
    print("  Compare to Lab 5 (Streams): XADD keeps every event whether or not a")
    print("  consumer is listening at the time.")


def demo_pattern():
    print("PSUBSCRIBE matches multiple channels with one pattern, e.g. 'chat:*'\n")
    pubsub = r.pubsub()
    pubsub.psubscribe("chat:*")
    pubsub.get_message(timeout=1)

    received = []
    stop = threading.Event()

    def listener():
        while not stop.is_set():
            message = pubsub.get_message(timeout=0.1)
            if message and message["type"] == "pmessage":
                received.append((message["channel"], message["data"]))

    t = threading.Thread(target=listener)
    t.start()
    time.sleep(0.2)

    for channel, text in [("chat:general", "hi all"), ("chat:random", "off-topic"), ("chat:general", "bye")]:
        r.publish(channel, text)
    time.sleep(0.3)
    stop.set()
    t.join()
    pubsub.close()

    print("Received via a single 'chat:*' pattern subscription:")
    for channel, text in received:
        print(f"  [{channel}] {text}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["subscribe", "publish", "loss-demo", "pattern-demo"])
    parser.add_argument("--channel", default="chat:general")
    parser.add_argument("--seconds", type=float, default=None, help="auto-stop 'subscribe' after N seconds")
    args = parser.parse_args()

    r.ping()

    if args.mode == "subscribe":
        subscribe(args.channel, seconds=args.seconds)
    elif args.mode == "publish":
        publish_interactive(args.channel)
    elif args.mode == "loss-demo":
        demo_loss()
    else:
        demo_pattern()
