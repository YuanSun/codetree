#!/usr/bin/env python3
"""
Run all tests for Budget Advisor project
"""

import subprocess
import sys
import os

def run_tests(component_name, test_dir):
    """Run tests for a component"""
    print(f"\n{'='*70}")
    print(f"Running {component_name} tests...")
    print(f"{'='*70}\n")

    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v"],
        cwd=test_dir,
        capture_output=False
    )

    return result.returncode

def main():
    """Main test runner"""
    print("="*70)
    print("Budget Advisor - Complete Test Suite")
    print("="*70)

    # Get the budget-advisor directory
    budget_advisor_dir = os.path.dirname(os.path.abspath(__file__))

    # Track results
    results = {}

    # Run PostgreSQL MCP Server tests
    mcp_dir = os.path.join(budget_advisor_dir, "postgres-mcp-server")
    results["PostgreSQL MCP Server"] = run_tests("PostgreSQL MCP Server", mcp_dir)

    # Run Advisor Agent tests
    advisor_dir = os.path.join(budget_advisor_dir, "advisor-agent")
    results["Ollama Advisor Agent"] = run_tests("Ollama Advisor Agent", advisor_dir)

    # Print summary
    print("\n" + "="*70)
    print("Test Summary")
    print("="*70)

    total_passed = 0
    total_failed = 0

    for component, returncode in results.items():
        status = "✓ PASSED" if returncode == 0 else "✗ FAILED"
        print(f"{component}: {status}")
        if returncode == 0:
            total_passed += 1
        else:
            total_failed += 1

    print(f"\nComponents: {total_passed} passed, {total_failed} failed")
    print("="*70)

    # Exit with error if any tests failed
    if total_failed > 0:
        sys.exit(1)
    else:
        print("\n✓ All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
