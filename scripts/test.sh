#!/bin/bash
set -e

COMMAND=${1:-unit}

case "$COMMAND" in
  unit)
    echo "=== Running Unit Tests ==="
    # Build sdk first to ensure inter-package dependencies (sdk -> client) resolve correctly
    npm run build -w @talosprotocol/sdk
    npm test -- --run
    ;;
  interop)
    echo "=== Running Vector Compliance (Conformance) ==="
    make conformance
    ;;
  lint)
    echo "=== Running Lint ==="
    make lint
    ;;
  typecheck)
    echo "=== Running Typecheck ==="
    make typecheck
    ;;
  *)
    echo "Error: Unknown command '$COMMAND'"
    exit 1
    ;;
esac
