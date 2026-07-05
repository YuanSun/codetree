# ZooKeeper Service Discovery — Experiment Plan

## Setup (run once)

```bash
./scripts/01-start-ensemble.sh
./scripts/02-check-quorum.sh        # confirm 1 leader, 2 followers
./scripts/03-build-client.sh
```

Then in three separate terminals:

```bash
# Terminal A: watcher (leave running throughout)
cd client && ./gradlew -q run -PmainClass=com.ryanlab.zkdiscovery.ServiceWatcher --args="orders-service"

# Terminal B: instance 1
cd client && ./gradlew -q run -PmainClass=com.ryanlab.zkdiscovery.ServiceRegistrar --args="orders-service 9101"

# Terminal C: instance 2
cd client && ./gradlew -q run -PmainClass=com.ryanlab.zkdiscovery.ServiceRegistrar --args="orders-service 9102"
```

Note the PIDs Terminal B and C print on startup — you'll need them below.

---

## Experiment 1 — Baseline registration

**Hypothesis:** both instances appear in the watcher within one poll cycle (~2s) of
registering, and `ls /services/orders-service` via zkCli shows exactly two ephemeral
children.

**Do:** just watch Terminal A after B and C start. Then run `04-inspect-znodes.sh`.

**Record:** time from registrar startup to watcher showing JOINED.

---

## Experiment 2 — Graceful shutdown vs hard crash

**Hypothesis:** graceful shutdown deregisters near-instantly (shutdown hook fires
synchronously). Hard crash deregisters only after ~session-timeout (configured to
10s in `DiscoveryFactory`), because ZK has no way to know the process is gone except
via missed heartbeats.

**Do:**
```bash
./scripts/05-kill-registrar.sh <pid-of-instance-1> graceful
# watch Terminal A, note the delay
# restart instance 1, then:
./scripts/05-kill-registrar.sh <pid-of-instance-2> hard
# watch Terminal A, note the delay
```

**Record:** actual deregistration latency for each. This is the number worth
remembering — "session timeout" is a configured ceiling, not a guarantee of
immediate detection, and production incidents (stale service entries routing
traffic into a dead pod) come from underestimating this gap.

---

## Experiment 3 — Simulated hang (SIGSTOP)

**Hypothesis:** a frozen-but-not-killed process is indistinguishable from a crashed
one, from ZK's point of view — because the heartbeat thread is frozen too. This
matters for real GC pauses: a sufficiently long stop-the-world GC can look exactly
like a crash to ZK.

**Do:**
```bash
./scripts/05-kill-registrar.sh <pid> hang
# wait past session timeout, confirm LEFT appears in watcher
./scripts/05-kill-registrar.sh <pid> resume
# check the resumed process's own stdout -- did it print "Session LOST"?
```

**Record:** does the resumed process realize its session is dead on its own, or
does it sit there thinking it's still registered? (It's the latter — this is the
operational trap. A process can be running and completely unaware it's been
deregistered.)

---

## Experiment 4 — Single ensemble node failure (no quorum loss)

**Hypothesis:** with 3 nodes, killing 1 has zero client-visible impact — reads and
writes continue against the remaining 2 (which still form a quorum of 2-of-3).

**Do:**
```bash
./scripts/02-check-quorum.sh                # note current leader
./scripts/06-kill-ensemble-node.sh <follower-node-number> stop
./scripts/02-check-quorum.sh                # confirm 2 remain, one still leader
# confirm registrar/watcher are unaffected -- no reconnection events logged
./scripts/06-kill-ensemble-node.sh <same-node> start
```

**Record:** did the client log any connection state change at all? (It shouldn't —
Curator's connection pool just stops using the dead node.)

---

## Experiment 5 — Quorum loss (kill 2 of 3)

**Hypothesis:** with only 1 of 3 nodes alive, the ensemble cannot process writes or
even most reads (ZK requires a quorum to serve most requests, to guarantee
linearizability). Existing registrations become **unreadable**, not just
un-writable — discovery calls should start failing or hanging.

**Do:**
```bash
./scripts/06-kill-ensemble-node.sh 2 stop
./scripts/06-kill-ensemble-node.sh 3 stop
./scripts/02-check-quorum.sh          # expect no leader reported
# try running the watcher again, or watch the existing Terminal A for errors
./scripts/06-kill-ensemble-node.sh 2 start
./scripts/06-kill-ensemble-node.sh 3 start
```

**Record:** exact error/behavior in the watcher when quorum is lost. Then time how
long it takes to recover once you restart the two nodes and the ensemble resyncs.

---

## Experiment 6 — Leader failure and re-election

**Hypothesis:** killing the leader specifically (not a follower) forces a new
leader election among the remaining two nodes. This should take longer than zero
but should complete within a few seconds — worth measuring precisely rather than
assuming.

**Do:**
```bash
./scripts/02-check-quorum.sh                       # identify current leader
./scripts/06-kill-ensemble-node.sh <leader-number> stop
# immediately start polling:
watch -n 1 ./scripts/02-check-quorum.sh            # macOS: brew install watch
```

**Record:** wall-clock time from leader death to a new leader being elected. Compare
this to Kafka's controller re-election time if you want a cross-system reference
point — same underlying problem (leader election over a coordination log), different
implementations.

---

## Open threads for next session

- [ ] Try `ServiceCache` (Curator's watch-based local cache) instead of polling in
      `ServiceWatcher` and compare event latency against the 2s poll interval.
- [ ] Add a second service name and confirm the base path (`/services`) cleanly
      namespaces multiple services without interference.
- [ ] Reduce `sessionTimeoutMs` to something absurdly low (e.g. 2000) and see if
      you start getting false-positive deregistrations from normal GC pauses or
      network jitter -- this is the real tradeoff behind session timeout tuning.
- [ ] Compare against Redis-based service discovery (TTL keys + keyspace
      notifications) if you do the Redis lab -- same problem, different consistency
      model.
