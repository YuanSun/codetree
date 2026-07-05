package com.ryanlab.zkdiscovery;

import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.CuratorFrameworkFactory;
import org.apache.curator.retry.ExponentialBackoffRetry;
import org.apache.curator.x.discovery.ServiceDiscovery;
import org.apache.curator.x.discovery.ServiceDiscoveryBuilder;
import org.apache.curator.x.discovery.ServiceInstance;

public class DiscoveryFactory {

    // All three ensemble nodes, addressed via the host-mapped ports from docker-compose.yml.
    // Curator will round-robin/failover across these automatically.
    public static final String ZK_CONNECT_STRING = "localhost:2191,localhost:2182,localhost:2183";

    public static final String BASE_PATH = "/services";

    /**
     * sessionTimeoutMs controls how long ZK waits without a heartbeat before it
     * declares the session dead and removes the client's ephemeral znodes.
     * Default in Curator is 60s if unset -- we set it explicitly and low (10s)
     * so the experiments in EXPERIMENTS.md are observable in a reasonable time.
     */
    public static CuratorFramework buildCuratorClient() {
        CuratorFramework client = CuratorFrameworkFactory.builder()
                .connectString(ZK_CONNECT_STRING)
                .sessionTimeoutMs(10_000)
                .connectionTimeoutMs(5_000)
                .retryPolicy(new ExponentialBackoffRetry(1000, 3))
                .build();
        client.start();
        return client;
    }

    // Payload is a String rather than Void so instances can carry a heartbeat
    // timestamp -- see ServiceRegistrar/ServiceWatcher for why a client's own
    // "did my read throw?" signal isn't sufficient proof its view is current.
    public static ServiceDiscovery<String> buildServiceDiscovery(CuratorFramework client) {
        ServiceDiscovery<String> discovery = ServiceDiscoveryBuilder.builder(String.class)
                .client(client)
                .basePath(BASE_PATH)
                .build();
        return discovery;
    }
}
