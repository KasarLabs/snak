#!/bin/bash

# Test Operators Script
# This script runs the tests for the operators and returns an error if any test fails

set -e  # Exit immediately if a command exits with a non-zero status

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧪 Running operator tests..."
echo "📁 Project root: $PROJECT_ROOT"

# Change to the agent package directory
cd "$PROJECT_ROOT/packages/agent"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in packages/agent directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  Warning: node_modules not found. Installing dependencies..."
    npm install
fi

# Run the tests for operators specifically
# Using Jest's pattern matching to only run tests in the operators directory
echo "🔍 Running tests in src/agents/operators/__tests__..."
npm test -- --testPathPattern="src/agents/operators/__tests__" --verbose

# The exit code is automatically handled by set -e
# If we reach here, the tests passed
echo "✅ All operator tests passed!" 