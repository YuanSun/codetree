package com.ryanlab.zkconfig;

public class ConfigPaths {

    public static final String BASE_PATH = "/config";

    public static String pathFor(String serviceName, String profile) {
        return BASE_PATH + "/" + serviceName + "/" + profile;
    }

    private ConfigPaths() {
    }
}
