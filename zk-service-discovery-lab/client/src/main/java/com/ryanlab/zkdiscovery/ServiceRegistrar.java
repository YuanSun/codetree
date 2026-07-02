package com.ryanlab.zkdiscovery;

import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.state.ConnectionState;
import org.apache.curator.x.discovery.ServiceDiscovery;
import org.apache.curator.x.discovery.ServiceInstance;

import java.util.UUID;

/**
 * Usage:
 *   mvn exec:java -Dexec.mainClass=com.ryanlab.zkdiscovery.ServiceRegistrar -Dexec.args="orders-service 9101"
 *
 * Run several of these (different ports, e.g. 9101, 9102, 9103) in separate terminals
 * to simulate multiple instances of the same service registering themselves.
 *
 * Print the PID on startup -- you'll need it for the kill scripts.
 */
public class ServiceRegistrar {

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

        ServiceDiscovery<Void> discovery = DiscoveryFactory.buildServiceDiscovery(client);
        discovery.start();

        ServiceInstance<Void> thisInstance = ServiceInstance.<Void>builder()
                .name(serviceName)
                .id(instanceId)
                .address("127.0.0.1")
                .port(port)
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

        // Keep alive. A SIGSTOP on this process pauses the JVM entirely, including
        // the background thread that sends ZK heartbeats -- that's what triggers
        // the session-timeout experiment even though the process is technically "alive."
        while (true) {
            Thread.sleep(5000);
            System.out.println("[" + timestamp() + "] still alive (pid " + pid + ")");
        }
    }

    private static String timestamp() {
        return java.time.LocalTime.now().withNano(0).toString();
    }
}
