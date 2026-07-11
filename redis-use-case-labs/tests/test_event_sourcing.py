def test_replay_derives_correct_balance(event_sourcing_lab):
    stream = event_sourcing_lab.STREAM_KEY
    event_sourcing_lab.r.delete(stream)

    event_sourcing_lab.emit("Deposited", amount=500)
    event_sourcing_lab.emit("Deposited", amount=250)
    event_sourcing_lab.emit("Withdrawn", amount=100)

    balance, history = event_sourcing_lab.rebuild_balance()
    assert balance == 650
    assert len(history) == 3
    assert [etype for _, etype, _ in history] == ["Deposited", "Deposited", "Withdrawn"]

    event_sourcing_lab.r.delete(stream)


def test_consumer_group_tracks_pending_until_acked(event_sourcing_lab):
    stream = event_sourcing_lab.STREAM_KEY
    group = event_sourcing_lab.GROUP_NAME
    event_sourcing_lab.r.delete(stream)
    event_sourcing_lab.r.xgroup_create(stream, group, id="0", mkstream=True)

    event_sourcing_lab.emit("Deposited", amount=100)
    event_sourcing_lab.emit("Deposited", amount=200)

    messages = event_sourcing_lab.r.xreadgroup(group, "consumer-a", {stream: ">"}, count=2)
    delivered_ids = [event_id for _, entries in messages for event_id, _ in entries]
    assert len(delivered_ids) == 2

    pending = event_sourcing_lab.r.xpending(stream, group)
    assert pending["pending"] == 2  # delivered but not yet acked

    for event_id in delivered_ids:
        event_sourcing_lab.r.xack(stream, group, event_id)

    pending_after = event_sourcing_lab.r.xpending(stream, group)
    assert pending_after["pending"] == 0

    event_sourcing_lab.r.delete(stream)
