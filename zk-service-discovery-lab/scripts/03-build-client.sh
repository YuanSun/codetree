#!/bin/bash
set -e
cd "$(dirname "$0")/../client"
echo "Building client (requires Java 11+ and Maven)..."
mvn -q clean package
echo "Build complete."
echo ""
echo "Run a registrar:  mvn exec:java -Dexec.mainClass=com.ryanlab.zkdiscovery.ServiceRegistrar -Dexec.args=\"orders-service 9101\""
echo "Run the watcher:   mvn exec:java -Dexec.mainClass=com.ryanlab.zkdiscovery.ServiceWatcher -Dexec.args=\"orders-service\""
