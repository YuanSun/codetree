package com.ryanlab.zkconfig;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ryanlab.zkdiscovery.DiscoveryFactory;
import org.apache.curator.framework.CuratorFramework;
import org.apache.zookeeper.CreateMode;
import org.apache.zookeeper.KeeperException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Usage:
 *   ./gradlew run -PmainClass=com.ryanlab.zkconfig.ConfigWriter --args="orders-service prod db.pool.size 20"
 *
 * Stands in for the "admin website" in a real ZK-backed config setup: this is
 * just a ZK client that does a read-modify-write on a single znode holding the
 * whole config profile as one JSON blob (this lab's chosen layout -- one znode
 * per key is the alternative, but a shared blob makes changes to related keys
 * atomic, which is what most real systems, including Spring Cloud Zookeeper
 * Config, actually use).
 *
 * The node is PERSISTENT, not EPHEMERAL -- config must survive this CLI process
 * exiting, unlike ServiceRegistrar's ephemeral registration znodes, which are
 * deliberately tied to the registering process's session.
 */
public class ConfigWriter {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("Usage: ConfigWriter <service-name> <profile> <key> <value>");
            System.exit(1);
        }
        String serviceName = args[0];
        String profile = args[1];
        String key = args[2];
        String value = args[3];
        String path = ConfigPaths.pathFor(serviceName, profile);

        CuratorFramework client = DiscoveryFactory.buildCuratorClient();

        Map<String, String> config;
        byte[] existing;
        try {
            existing = client.getData().forPath(path);
        } catch (KeeperException.NoNodeException notThere) {
            existing = null;
        }

        if (existing == null || existing.length == 0) {
            config = new LinkedHashMap<>();
        } else {
            config = MAPPER.readValue(existing, new TypeReference<Map<String, String>>() {
            });
        }

        String oldValue = config.get(key);
        config.put(key, value);
        byte[] updated = MAPPER.writeValueAsBytes(config);

        try {
            client.setData().forPath(path, updated);
        } catch (KeeperException.NoNodeException notThere) {
            client.create().creatingParentContainersIfNeeded().withMode(CreateMode.PERSISTENT).forPath(path, updated);
        }

        System.out.println("Updated " + path);
        System.out.println("  " + key + ": " + (oldValue == null ? "(new)" : oldValue) + " -> " + value);
        System.out.println("Full config now: " + config);

        client.close();
    }
}
