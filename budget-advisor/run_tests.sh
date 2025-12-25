#!/bin/bash
# Run all tests for Budget Advisor project

set -e

echo "======================================"
echo "Budget Advisor - Test Suite"
echo "======================================"
echo ""

# Install test dependencies if needed
if ! python3 -c "import pytest" 2>/dev/null; then
    echo "Installing test dependencies..."
    pip3 install -q -r requirements-dev.txt
fi

# Install project dependencies
echo "Installing project dependencies..."
pip3 install -q -r postgres-mcp-server/requirements.txt
pip3 install -q -r advisor-agent/requirements.txt

echo ""
echo "Running all tests..."
echo ""

# Run pytest from the budget-advisor directory
python3 -m pytest

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
