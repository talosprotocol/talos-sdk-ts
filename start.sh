#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🚀 Starting SDK E2E Example..."

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build SDK first
echo "🛠️  Building SDK..."
npm run build

# Run Client Example
echo "▶️  Running Client E2E..."
npm run example:e2e -w @talos-protocol/client
