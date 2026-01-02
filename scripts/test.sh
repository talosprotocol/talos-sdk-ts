#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# talos-sdk-ts Test Script
# =============================================================================

echo "Testing talos-sdk-ts..."

echo "Installing dependencies..."
npm ci --silent

echo "Running lint..."
npm run lint

echo "Running format check..."
npm run format:check 2>/dev/null || echo "format:check not configured"

echo "Running typecheck..."
npm run typecheck

echo "Running tests..."
npm test -- --run

if [[ "${TALOS_SKIP_BUILD:-false}" != "true" ]]; then
  echo "Running build..."
  npm run build
fi

echo "talos-sdk-ts tests passed."
