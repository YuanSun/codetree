package com.ryanlab.zkconfig;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ryanlab.zkdiscovery.DiscoveryFactory;
import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.recipes.cache.CuratorCache;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Usage:
 *   ./gradlew run -PmainClass=com.ryanlab.zkconfig.ConfigWatcher --args="orders-service prod"
 *
 * Stands in for a running application's config-refresh mechanism -- what Spring
 * Cloud Zookeeper Config + @RefreshScope does under the hood -- without needing
 * a Spring app: watches a single config znode via Curator's CuratorCache (the
 * modern replacement for NodeCache; it handles re-arming ZK's one-shot watches
 * for you) and prints a per-key diff on every update, including the initial
 * load. No restart, no polling required.
 *
 * Run ConfigWriter (in another terminal, same service/profile) while this is
 * running to see live ADDED/CHANGED/REMOVED lines appear with no restart.
 */
public class ConfigWatcher {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: ConfigWatcher <service-name> <profile>");
            System.exit(1);
        }
        String serviceName = args[0];
        String profile = args[1];
        String path = ConfigPaths.pathFor(serviceName, profile);

        CuratorFramework client = DiscoveryFactory.buildCuratorClient();
        CuratorCache cache = CuratorCache.builder(client, path)
                .withOptions(CuratorCache.Options.SINGLE_NODE_CACHE)
                .build();

        AtomicReference<Map<String, String>> previous = new AtomicReference<>(new HashMap<>());

        cache.listenable().addListener((type, oldData, data) -> {
            Map<String, String> current = parseConfig(data != null ? data.getData() : null);
            Map<String, String> old = previous.getAndSet(current);
            printDiff(old, current);
        });

        cache.start();
        System.out.println("Watching config at " + path + " (Ctrl+C to stop)");

        Thread.currentThread().join();
    }

    private static void printDiff(Map<String, String> old, Map<String, String> current) {
        String ts = timestamp();
        TreeSet<String> allKeys = new TreeSet<>();
        allKeys.addAll(old.keySet());
        allKeys.addAll(current.keySet());

        for (String key : allKeys) {
            String oldVal = old.get(key);
            String newVal = current.get(key);
            if (Objects.equals(oldVal, newVal)) {
                continue;
            }
            if (oldVal == null) {
                System.out.println("[" + ts + "] ADDED   " + key + " = " + newVal);
            } else if (newVal == null) {
                System.out.println("[" + ts + "] REMOVED " + key + " (was " + oldVal + ")");
            } else {
                System.out.println("[" + ts + "] CHANGED " + key + ": " + oldVal + " -> " + newVal);
            }
        }
    }

    private static Map<String, String> parseConfig(byte[] data) {
        if (data == null || data.length == 0) {
            return new HashMap<>();
        }
        try {
            return MAPPER.readValue(data, new TypeReference<Map<String, String>>() {
            });
        } catch (Exception e) {
            System.out.println("Failed to parse config data: " + e);
            return new HashMap<>();
        }
    }

    private static String timestamp() {
        return java.time.LocalTime.now().withNano(0).toString();
    }
}
