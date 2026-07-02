#!/bin/bash
# Usage: ./05-kill-registrar.sh <pid> <graceful|hard|hang|resume>

PID="$1"
MODE="$2"

if [ -z "$PID" ] || [ -z "$MODE" ]; then
  echo "Usage: $0 <pid> <graceful|hard|hang|resume>"
  echo ""
  echo "  graceful  - kill -TERM  : shutdown hook fires, znode unregistered immediately"
  echo "  hard      - kill -9     : no hook, no FIN packet -- ZK only notices via missed heartbeats"
  echo "  hang      - kill -STOP  : freezes the JVM, including its heartbeat thread, without killing it"
  echo "  resume    - kill -CONT  : resumes a hung (-STOP'd) process"
  exit 1
fi

case "$MODE" in
  graceful)
    echo "Sending SIGTERM to $PID (graceful)..."
    kill -TERM "$PID"
    echo "Watch the ServiceWatcher terminal -- deregistration should appear almost instantly."
    ;;
  hard)
    echo "Sending SIGKILL to $PID (hard crash, no cleanup)..."
    kill -9 "$PID"
    echo "Watch the ServiceWatcher terminal -- deregistration will lag by roughly the"
    echo "session timeout (10s configured in DiscoveryFactory) plus ZK's own detection delay."
    echo "Time how long it actually takes -- that's the real number, not the config value."
    ;;
  hang)
    echo "Sending SIGSTOP to $PID (simulated hang, process frozen but alive)..."
    kill -STOP "$PID"
    echo "The process still exists (check: ps -p $PID) but sends no heartbeats."
    echo "This should behave identically to 'hard' from ZK's perspective -- confirm that."
    ;;
  resume)
    echo "Sending SIGCONT to $PID (resuming)..."
    kill -CONT "$PID"
    echo "If the session already expired while frozen, the process is now running but"
    echo "its ZK session is dead -- it CANNOT silently re-register. Check its stdout:"
    echo "did the ConnectionStateListener print LOST? If so, this instance is orphaned"
    echo "until you restart it as a fresh process. This is the key operational lesson:"
    echo "'process alive' and 'service registered' are two different facts."
    ;;
  *)
    echo "Unknown mode: $MODE"
    exit 1
    ;;
esac
