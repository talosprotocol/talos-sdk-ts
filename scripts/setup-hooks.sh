#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛠️  Setting up git hooks for talos-sdk-ts..."

cd "$REPO_ROOT"
mkdir -p .githooks
cat > .githooks/pre-commit <<EOF
#!/bin/sh
bash scripts/pre-commit
EOF
chmod +x .githooks/pre-commit
chmod +x scripts/pre-commit
git config core.hooksPath .githooks

echo "✅ Hooks installed!"
