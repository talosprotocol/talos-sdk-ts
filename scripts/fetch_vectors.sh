#!/bin/bash
set -e

# Simulates fetching the pinned test_vectors artifact from CI/Release
# API Integration Contract: 
# The SDK depends on "protocol contracts" (vectors) but does NOT link to core repo files.

DEST_DIR="$(cd "$(dirname "$0")/.." && pwd)/test_vectors"
# Resolve Workspace Root (4 levels up from scripts/)
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SOURCE_REF="$REPO_ROOT/test_vectors"

echo "📥 Fetching Protocol Vectors..."
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

if [ -d "$SOURCE_REF" ]; then
    cp -R "$SOURCE_REF/"* "$DEST_DIR/"
    echo "✅ Vectors fetched successfully."
else
    echo "❌ Error: Could not locate upstream vectors (simulation mode)."
    exit 1
fi
