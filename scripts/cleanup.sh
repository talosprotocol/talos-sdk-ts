#!/usr/bin/env bash
set -euo pipefail

# talos-sdk-ts cleanup script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Cleaning talos-sdk-ts..."
cd "$REPO_DIR"

# Node.js artifacts
rm -rf node_modules
rm -rf dist build out
rm -rf .next .turbo
rm -rf .eslintcache
rm -rf .tsbuildinfo *.tsbuildinfo

# Coverage & reports
rm -rf coverage 2>/dev/null || true
rm -f lcov.info coverage.xml junit.xml conformance.xml 2>/dev/null || true

echo "✓ talos-sdk-ts cleaned"
