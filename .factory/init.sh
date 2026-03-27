#!/bin/bash
# Browser-AI Cleanup Mission Init Script

set -e

echo "Initializing cleanup mission environment..."

# Verify Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed"
    exit 1
fi

# Verify npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is required but not installed"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Verify build works
echo "Verifying build..."
npm run build

echo "Environment initialized successfully!"
echo ""
echo "Available commands:"
echo "  npm run build       - Build the extension"
echo "  npm run typecheck   - Run TypeScript type checking"
echo "  npm run lint        - Run Biome linting"
echo "  npm run knip        - Run dead code detection"
echo "  npm run test:unit   - Run unit tests"
