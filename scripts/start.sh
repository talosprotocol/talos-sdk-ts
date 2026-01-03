#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting SDK E2E Example..."
cd "$REPO_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Build SDK first
echo "🛠️  Building SDK..."
npm run build

# Run Client Example
echo "▶️  Running Client E2E..."
npm run example:e2e -w @talosprotocol/client
