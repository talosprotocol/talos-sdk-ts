#!/usr/bin/env bash
# Contract compliance gates
# Enforces @talosprotocol/contracts as single source of truth
set -euo pipefail

ROOT="${1:-.}"

echo "=== Contract Compliance Gates ==="

# 1) Deep-link ban
echo "Checking for deep link imports..."
if grep -rn "file:///\|\.\./talos-\|workspace/\|github\.com/talosprotocol/talos/blob" "$ROOT/packages" "$ROOT/examples" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ ERROR: deep links detected"
  exit 1
fi
echo "✅ No deep links"

# 2) btoa/atob ban
echo "Checking for banned btoa/atob usage..."
if grep -rn "\bbtoa\b\|\batob\b" "$ROOT/packages" "$ROOT/examples" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ ERROR: btoa/atob detected. Use @talosprotocol/contracts helpers."
  exit 1
fi
echo "✅ No btoa/atob in packages/"

# 3) Local contract function implementation ban (exact name match)
echo "Checking for exact contract function reimplementations..."
if grep -rn "^\s*function\s\+deriveCursor\s*(\|^\s*function\s\+decodeCursor\s*(\|^\s*function\s\+compareCursor\s*(\|^\s*const\s\+deriveCursor\s*=\|^\s*const\s\+decodeCursor\s*=\|^\s*const\s\+compareCursor\s*=" "$ROOT/packages" "$ROOT/examples" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "export\s*{"; then
  echo "❌ ERROR: local cursor implementation detected (exact name match)"
  exit 1
fi
echo "✅ No local contract reimplementations"

echo ""
echo "=== All contract gates passed ✅ ==="
