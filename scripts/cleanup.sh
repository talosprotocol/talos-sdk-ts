#!/usr/bin/env bash
set -euo pipefail

# talos-sdk-ts cleanup script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Cleaning talos-sdk-ts..."
cd "$REPO_DIR"

rm -rf node_modules
rm -rf dist build out
rm -rf .next .turbo
rm -rf coverage
rm -rf .eslintcache

echo "✓ talos-sdk-ts cleaned"
