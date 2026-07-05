package com.ryanlab.zkdiscovery;

import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.state.ConnectionState;
import org.apache.curator.x.discovery.ServiceDiscovery;
import org.apache.curator.x.discovery.ServiceInstance;

import java.util.UUID;

/**
 * Usage:
 *   ./gradlew run -PmainClass=com.ryanlab.zkdiscovery.ServiceRegistrar --args="orders-service 9101"
 *
 * Run several of these (different ports, e.g. 9101, 9102, 9103) in separate terminals
 * to simulate multiple instances of the same service registering themselves.
 *
 * Print the PID on startup -- you'll need it for the kill scripts.
 *
 * The registered znode's payload carries a heartbeat timestamp, refreshed every
 * HEARTBEAT_INTERVAL_MS via discovery.updateService(). This lets a watcher verify
 * data freshness independently of whether its own read call threw an exception --
 * see EXPERIMENTS.md's "silently stale watcher" finding for why that distinction
 * matters (a client's read can succeed while still returning stale data).
 */
public class ServiceRegistrar {

    private static final long HEARTBEAT_INTERVAL_MS = 3000;

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: ServiceRegistrar <service-name> <port>");
            System.exit(1);
        }

        String serviceName = args[0];
        int port = Integer.parseInt(args[1]);
        String instanceId = "instance-" + UUID.randomUUID().toString().substring(0, 8);

        long pid = ProcessHandle.current().pid();
        System.out.println("=== ServiceRegistrar starting ===");
        System.out.println("PID:         " + pid);
        System.out.println("Service:     " + serviceName);
        System.out.println("Instance ID: " + instanceId);
        System.out.println("Port:        " + port);
        System.out.println("==================================");
        System.out.println("(kill -TERM " + pid + "  -> graceful unregister)");
        System.out.println("(kill -9    " + pid + "  -> hard crash, watch session-timeout deregistration)");
        System.out.println("(kill -STOP " + pid + "  -> simulate hang, no heartbeats sent)");
        System.out.println("(kill -CONT " + pid + "  -> resume from hang)");

        CuratorFramework client = DiscoveryFactory.buildCuratorClient();

        client.getConnectionStateListenable().addListener((c, newState) -> {
            System.out.println("[" + timestamp() + "] Connection state changed: " + newState);
            if (newState == ConnectionState.LOST) {
                System.out.println("[" + timestamp() + "] Session LOST -- ZK has expired this session."
                        + " Ephemeral znode is gone. This process cannot re-register without restarting.");
            } else if (newState == ConnectionState.SUSPENDED) {
                System.out.println("[" + timestamp() + "] Session SUSPENDED -- connection dropped,"
                        + " but session hasn't timed out yet. Ephemeral znode may still be alive.");
            } else if (newState == ConnectionState.RECONNECTED) {
                System.out.println("[" + timestamp() + "] RECONNECTED -- same session resumed, znode intact.");
            }
        });

        ServiceDiscovery<String> discovery = DiscoveryFactory.buildServiceDiscovery(client);
        discovery.start();

        ServiceInstance<String> thisInstance = ServiceInstance.<String>builder()
                .name(serviceName)
                .id(instanceId)
                .address("127.0.0.1")
                .port(port)
                .payload(String.valueOf(System.currentTimeMillis()))
                .build();

        discovery.registerService(thisInstance);
        System.out.println("[" + timestamp() + "] Registered. Znode path: /services/" + serviceName + "/" + instanceId);
        System.out.println("Inspect it directly with:");
        System.out.println("  docker exec -it zk1 zkCli.sh -server localhost:2181 get /services/" + serviceName + "/" + instanceId);

        // Graceful shutdown: explicitly unregister before closing.
        // This is what does NOT happen on kill -9 -- that's the whole point of the experiment.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                System.out.println("[" + timestamp() + "] Shutdown hook firing -- unregistering gracefully.");
                discovery.unregisterService(thisInstance);
                discovery.close();
                client.close();
                System.out.println("[" + timestamp() + "] Unregistered and closed cleanly.");
            } catch (Exception e) {
                e.printStackTrace();
            }
        }));

        // Keep alive, refreshing the heartbeat payload on the znode itself. A SIGSTOP
        // on this process pauses the JVM entirely, including this loop -- that's what
        // triggers the session-timeout experiment even though the process is
        // technically "alive," and it's also what makes the heartbeat go stale from a
        // watcher's point of view even in scenarios where the session itself survives.
        while (true) {
            Thread.sleep(HEARTBEAT_INTERVAL_MS);
            ServiceInstance<String> refreshed = ServiceInstance.<String>builder()
                    .name(serviceName)
                    .id(instanceId)
                    .address("127.0.0.1")
                    .port(port)
                    .payload(String.valueOf(System.currentTimeMillis()))
                    .build();
            discovery.updateService(refreshed);
            System.out.println("[" + timestamp() + "] still alive (pid " + pid + "), heartbeat refreshed");
        }
    }

    private static String timestamp() {
        return java.time.LocalTime.now().withNano(0).toString();
    }
}
