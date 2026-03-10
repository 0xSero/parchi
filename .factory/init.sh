#!/bin/bash
# Mission initialization script for Parchi refactoring
# This script is idempotent - safe to run multiple times

set -e

echo "=== Parchi Refactoring Mission Init ==="

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "none")
if [ "$NODE_VERSION" = "none" ]; then
    echo "ERROR: Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "Node.js version: $NODE_VERSION"

# Install dependencies if node_modules doesn't exist or package-lock changed
if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi

# Verify build works
echo "Verifying build..."
if ! npm run build > /dev/null 2>&1; then
    echo "WARNING: Build failed. This may be expected if refactoring in progress."
fi

# Run typecheck to establish baseline
echo "Running typecheck..."
if npm run typecheck > /dev/null 2>&1; then
    echo "TypeScript: OK"
else
    echo "TypeScript: Issues found (may be expected during refactoring)"
fi

# Check for test infrastructure
if [ -d "tests" ]; then
    echo "Test infrastructure: OK"
else
    echo "WARNING: tests/ directory not found"
fi

# Check for required environment variables (for e2e tests)
if [ -n "$DECOMPOSER_API_KEY" ]; then
    echo "E2E test credentials: Configured"
else
    echo "E2E test credentials: Not set (set DECOMPOSER_API_KEY for e2e tests)"
fi

echo ""
echo "=== Init Complete ==="
echo "Ready for refactoring work."
echo ""
echo "Key commands:"
echo "  npm run build          - Build extension"
echo "  npm run typecheck      - TypeScript check"
echo "  npm run test:unit      - Run unit tests"
echo "  npm run test:coverage  - Run coverage validation"
echo "  npm run lint           - Run linter"
