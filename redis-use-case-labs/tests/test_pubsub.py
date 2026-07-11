def test_publish_before_subscribe_is_lost(pubsub_lab):
    channel = "test:pubsub:loss"
    receivers = pubsub_lab.r.publish(channel, "nobody hears this")
    assert receivers == 0  # no subscriber connected, message vanishes


def test_subscriber_receives_published_message(pubsub_lab):
    channel = "test:pubsub:delivery"
    ps = pubsub_lab.r.pubsub()
    ps.subscribe(channel)
    ps.get_message(timeout=1)  # consume the subscribe confirmation event

    receivers = pubsub_lab.r.publish(channel, "hello")
    assert receivers == 1

    message = ps.get_message(timeout=1)
    assert message["type"] == "message"
    assert message["data"] == "hello"

    ps.close()


def test_pattern_subscription_matches_multiple_channels(pubsub_lab):
    ps = pubsub_lab.r.pubsub()
    ps.psubscribe("test:pubsub:pattern:*")
    ps.get_message(timeout=1)

    pubsub_lab.r.publish("test:pubsub:pattern:a", "one")
    pubsub_lab.r.publish("test:pubsub:pattern:b", "two")

    received = []
    for _ in range(2):
        message = ps.get_message(timeout=1)
        if message and message["type"] == "pmessage":
            received.append(message["data"])

    assert set(received) == {"one", "two"}

    ps.close()
