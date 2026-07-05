#!/bin/bash
set -e
cd "$(dirname "$0")/../client"
echo "Building client (requires Java 11+; Gradle itself is downloaded automatically by the wrapper)..."
./gradlew -q clean build
echo "Build complete."
echo ""
echo "Run a registrar:  ./gradlew run -PmainClass=com.ryanlab.zkdiscovery.ServiceRegistrar --args=\"orders-service 9101\""
echo "Run the watcher:   ./gradlew run -PmainClass=com.ryanlab.zkdiscovery.ServiceWatcher --args=\"orders-service\""
