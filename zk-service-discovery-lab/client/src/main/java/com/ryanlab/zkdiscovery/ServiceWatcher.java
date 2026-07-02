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
 *   mvn exec:java -Dexec.mainClass=com.ryanlab.zkdiscovery.ServiceWatcher -Dexec.args="orders-service"
 *
 * Polls every 2 seconds and prints instance IDs currently registered, plus a diff
 * against the previous poll so joins/leaves are obvious without reading closely.
 *
 * Note: this uses queryForInstances() (a direct read) rather than Curator's ServiceCache
 * (a watch-based local cache) deliberately -- for this lab, seeing the raw read-latency
 * of deregistration is more instructive than an event-driven callback would be.
 */
public class ServiceWatcher {

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: ServiceWatcher <service-name>");
            System.exit(1);
        }
        String serviceName = args[0];

        CuratorFramework client = DiscoveryFactory.buildCuratorClient();
        ServiceDiscovery<Void> discovery = DiscoveryFactory.buildServiceDiscovery(client);
        discovery.start();

        System.out.println("Watching service: " + serviceName + " (polling every 2s, Ctrl+C to stop)");

        Set<String> previous = new HashSet<>();

        while (true) {
            Collection<ServiceInstance<Void>> instances = discovery.queryForInstances(serviceName);
            Set<String> current = instances.stream()
                    .map(ServiceInstance::getId)
                    .collect(Collectors.toSet());

            Set<String> joined = new HashSet<>(current);
            joined.removeAll(previous);
            Set<String> left = new HashSet<>(previous);
            left.removeAll(current);

            String ts = java.time.LocalTime.now().withNano(0).toString();

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
            Thread.sleep(2000);
        }
    }
}
