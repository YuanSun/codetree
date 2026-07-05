package com.ryanlab.zkdiscovery;

import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.x.discovery.ServiceDiscovery;
import org.apache.curator.x.discovery.ServiceInstance;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Usage:
 *   ./gradlew run -PmainClass=com.ryanlab.zkdiscovery.ServiceWatcher --args="orders-service"
 *
 * Polls every 2 seconds and prints instance IDs currently registered, plus a diff
 * against the previous poll so joins/leaves are obvious without reading closely.
 *
 * Note: this uses queryForInstances() (a direct read) rather than Curator's ServiceCache
 * (a watch-based local cache) deliberately -- for this lab, seeing the raw read-latency
 * of deregistration is more instructive than an event-driven callback would be.
 *
 * Staleness detection: EXPERIMENTS.md documents a real, reproduced finding -- a
 * long-lived watcher can survive a genuine quorum-loss outage and keep polling
 * successfully (no thrown exception, no connection-state-change log) while no longer
 * reflecting reality. Neither exception handling nor Curator's own connection-state
 * listener would have caught that, because the read didn't fail and the state
 * machine didn't report anything unusual. The only thing that actually catches it is
 * checking the *content* of what came back: each instance's payload carries a
 * heartbeat timestamp refreshed every few seconds by the registrar, so this watcher
 * independently compares that timestamp's age against wall-clock time on every poll,
 * regardless of whether the read itself "succeeded."
 */
public class ServiceWatcher {

    private static final long POLL_INTERVAL_MS = 2000;
    private static final long STALE_THRESHOLD_MS = 9000; // > registrar's 3s heartbeat interval, with margin

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: ServiceWatcher <service-name>");
            System.exit(1);
        }
        String serviceName = args[0];

        CuratorFramework client = DiscoveryFactory.buildCuratorClient();

        client.getConnectionStateListenable().addListener((c, newState) -> {
            System.out.println("[" + timestamp() + "] Connection state changed: " + newState
                    + " (reminder: not proof the view below is current -- see EXPERIMENTS.md)");
        });

        ServiceDiscovery<String> discovery = DiscoveryFactory.buildServiceDiscovery(client);
        discovery.start();

        System.out.println("Watching service: " + serviceName + " (polling every 2s, Ctrl+C to stop)");

        Set<String> previous = new HashSet<>();

        while (true) {
            String ts = timestamp();
            Collection<ServiceInstance<String>> instances;
            try {
                instances = discovery.queryForInstances(serviceName);
            } catch (Exception e) {
                System.out.println("[" + ts + "] POLL FAILED (" + e.getClass().getSimpleName()
                        + ": " + e.getMessage() + ") -- treating current view as stale.");
                Thread.sleep(POLL_INTERVAL_MS);
                continue;
            }

            long now = System.currentTimeMillis();
            for (ServiceInstance<String> instance : instances) {
                long ageMs = now - Long.parseLong(instance.getPayload());
                if (ageMs > STALE_THRESHOLD_MS) {
                    System.out.println("[" + ts + "] STALE DATA WARNING: " + instance.getId()
                            + " heartbeat is " + (ageMs / 1000) + "s old (threshold "
                            + (STALE_THRESHOLD_MS / 1000) + "s) -- do not trust this view.");
                }
            }

            Set<String> current = instances.stream()
                    .map(ServiceInstance::getId)
                    .collect(Collectors.toSet());

            Set<String> joined = new HashSet<>(current);
            joined.removeAll(previous);
            Set<String> left = new HashSet<>(previous);
            left.removeAll(current);

            if (!joined.isEmpty()) {
                System.out.println("[" + ts + "] JOINED: " + joined);
            }
            if (!left.isEmpty()) {
                System.out.println("[" + ts + "] LEFT (deregistered):    " + left);
            }
            if (joined.isEmpty() && left.isEmpty()) {
                System.out.println("[" + ts + "] no change -- current instances: " + current);
            }

            previous = current;
            Thread.sleep(POLL_INTERVAL_MS);
        }
    }

    private static String timestamp() {
        return java.time.LocalTime.now().withNano(0).toString();
    }
}
