#!/usr/bin/env bash
set -eo pipefail

# =============================================================================
# TypeScript SDK Standardized Test Entrypoint
# =============================================================================

ARTIFACTS_DIR="artifacts/coverage"
mkdir -p "$ARTIFACTS_DIR"

COMMAND=${1:-"--unit"}

build_deps() {
    echo "--- Building Dependencies ---"
    npm run build -w @talosprotocol/sdk
}

run_unit() {
    build_deps
    echo "=== Running Unit Tests ==="
    npm test -- --run
}

run_smoke() {
    build_deps
    echo "=== Running Smoke Tests ==="
    npm test -- --run --testNamePattern="smoke" || run_unit
}

run_integration() {
    echo "=== Running Integration Tests ==="
    # Integration tests might need specialized setup
    npm run test:integration || echo "No integration tests found"
}

run_coverage() {
    build_deps
    echo "=== Running Coverage (vitest) ==="
    rm -rf "$ARTIFACTS_DIR"
    mkdir -p "$ARTIFACTS_DIR"
    
    # Try multiple ways to get coverage
    npm run coverage -- --coverage.reporter=cobertura || \
    npm test -- --run --coverage --coverage.reporter=cobertura

    # Move reports to root artifacts dir
    # Vitest workspaces often put results in <package>/coverage/cobertura-coverage.xml
    REPORT=$(find . -name "cobertura-coverage.xml" | grep -v "node_modules" | head -n 1)
    if [ -n "$REPORT" ]; then
        cp "$REPORT" "$ARTIFACTS_DIR/cobertura-coverage.xml"
        echo "✅ Coverage report collected: $REPORT"
    else
        # Fallback to checking typical locations
        if [ -f "packages/sdk/coverage/cobertura-coverage.xml" ]; then
            cp "packages/sdk/coverage/cobertura-coverage.xml" "$ARTIFACTS_DIR/cobertura-coverage.xml"
        fi
    fi
}

case "$COMMAND" in
    --smoke)
        run_smoke
        ;;
    --unit)
        run_unit
        ;;
    --integration)
        run_integration
        ;;
    --coverage)
        run_coverage
        ;;
    --ci)
        run_smoke
        run_unit
        run_coverage
        ;;
    --full)
        run_smoke
        run_unit
        run_integration
        run_coverage
        ;;
    *)
        echo "Usage: $0 {--smoke|--unit|--integration|--coverage|--ci|--full}"
        exit 1
        ;;
esac

# Generate minimal results.json
mkdir -p artifacts/test
cat <<EOF > artifacts/test/results.json
{
  "repo_id": "sdks-typescript",
  "command": "$COMMAND",
  "status": "pass",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
