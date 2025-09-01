#!/bin/bash

# Simple Test Operators Script for CI/CD
# This script runs the tests for the operators and returns an error if any test fails

set -e

echo "Running operator tests..."

# Check if packages/agent directory exists
if [ ! -d "packages/agent" ]; then
    echo "Error: packages/agent directory does not exist or is not a directory"
    exit 1
fi

cd packages/agent

# Run tests with minimal output for CI
npm test -- --testPathPattern="src/agents/operators/__tests__" --silent

echo "All operator tests passed!" 