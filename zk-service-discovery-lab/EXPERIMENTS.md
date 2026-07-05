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

**Observed nuance (worth watching for):** the resumed process doesn't necessarily
even print `Session LOST`. `kill -STOP` freezes *every* thread in the JVM, including
Curator's own `SendThread`/`EventThread` -- the machinery that would normally notice
the disconnect and correctly classify it as a real session expiry. On resume, that
state machine only sees "before" and "after," not the gap in between, so its
SUSPENDED-vs-LOST-vs-RECONNECTED classification can be wrong: in one run, the
watcher correctly showed the instance as `LEFT` (server-side expiry, confirmed via
`04-inspect-znodes.sh`), while the resumed process's own connection listener printed
`RECONNECTED -- same session resumed, znode intact` -- despite connecting with a
brand-new session ID and the znode being genuinely, permanently gone. The client's
self-report was simply incorrect. There is no live-recovery path once this happens:
the process must be killed and restarted (with a fresh instance ID) to re-register.
This is the same underlying phenomenon as "a long GC pause can look like a crash to
ZooKeeper," just sharper than the hypothesis above assumes -- it's not only the
server's failure detection that can be fooled by a stalled JVM, the client's own
diagnosis of its connection state can be fooled too. Treat the watcher/server-side
view as ground truth, never the client's self-reported connection state.

**Implemented -- self-healing registration:** the same orphan-process pattern was
also reproduced via real infrastructure (not just `SIGSTOP`) during Experiment 6 --
killing the leader disrupted both registrars' connections for long enough that both
sessions expired, both znodes were deleted server-side, and both processes kept
running indefinitely without ever re-registering, requiring a manual restart to
recover. `ServiceRegistrar` now defensively re-registers itself on every
`RECONNECTED`/`CONNECTED` event, catching `NodeExistsException` as the harmless
"it was fine all along" case, rather than relying on the (proven unreliable)
connection-state self-report to decide whether recovery is needed. This should
close the loop for the leader-kill scenario and for real quorum-loss-driven
expiry -- though not necessarily for a true `SIGSTOP`, since a fully frozen JVM
can't run this listener callback either until it resumes, at which point it should
now fire correctly. Worth re-running Experiment 6 (and this SIGSTOP experiment) to
confirm the registrar now recovers automatically instead of needing a restart.

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

**Observed nuance -- the most important one in this lab:** a `ServiceWatcher` that
was already running *before* the outage and stays running *through* the entire
kill-two-followers -> quorum lost -> restart-two-followers -> quorum restored cycle
can end up **silently stale**: it keeps polling every 2s, prints no errors, never
logs a connection-state change, and yet stops reflecting reality -- a brand new
`ServiceRegistrar` instance that is confirmed present via `04-inspect-znodes.sh`
(and thus confirmed correctly replicated across the ensemble) simply never appears
in that watcher's `current instances` output. Killing that watcher process and
starting a fresh one fixes it immediately -- the fresh process sees the instance
right away. So the underlying ZK data was never wrong; only that one long-lived
client's view of it was.

This is a sharper, real-infrastructure version of the Experiment 3 finding: you
cannot rely on "the process is still running and printing normal-looking output"
as a signal that a ZK client's view of the world is current. This is a genuine
production risk, not just a lab curiosity -- a silently stale service-discovery
watcher is *more* dangerous than a crashed one, because it passes every
process-liveness check (still running, still consuming CPU, still logging) while
serving membership data frozen at the moment of some earlier outage. A crashed
process gets restarted by a supervisor; a zombie one doesn't, because nothing
signals it's broken.

Mitigations real systems use for this (worth trying as a follow-up exercise):
- Actively check `client.getState()` / connection health on a timer, rather than
  inferring health from "my poll loop is still executing."
- Canary reads or writes: periodically touch a known heartbeat znode and verify
  round-trip freshness; force-rebuild the client if the canary goes stale.
- Track "time since last *verified* successful refresh" and treat the whole local
  view as untrustworthy (fail closed) past some staleness threshold.
- React defensively the moment `SUSPENDED` fires instead of waiting for `LOST` --
  which, as Experiment 3 showed, may never arrive, or may arrive with the wrong
  verdict.

**Implemented:** the second bullet above (canary/heartbeat freshness) is now built
into `ServiceRegistrar`/`ServiceWatcher`, specifically *because* the first and third
bullets would not have caught this exact bug -- the read never threw, and the
connection-state listener never fired, so there was nothing to catch on that side.
`ServiceRegistrar` now refreshes a heartbeat timestamp into its own znode payload
every 3s via `discovery.updateService(...)`. `ServiceWatcher` independently compares
that timestamp's age against wall-clock time on every poll and prints a
`STALE DATA WARNING` if it's older than 9s (also now added: a connection-state
listener for visibility, and a try/catch around the poll so a real failure logs
clearly instead of crashing silently). This check is deliberately independent of
whether the read call "succeeded" -- it inspects the freshness of the data itself,
which is the only thing that actually would have caught the bug above.

To retest: reproduce the Experiment 5 sequence again (kill 2 followers, wait, bring
them back) with a `ServiceWatcher` that was already running through the whole
outage, and see whether `STALE DATA WARNING` now appears where the old watcher gave
no signal at all.

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
