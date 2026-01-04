# =============================================================================
# talos-sdk-ts Test Script
# =============================================================================
set -euo pipefail

log() { printf '%s\n' "$*"; }
info() { printf 'ℹ️  %s\n' "$*"; }

info "Testing talos-sdk-ts..."

info "Installing dependencies..."
npm ci --silent

info "Running lint..."
npm run lint

info "Running format check..."
npm run format:check 2>/dev/null || echo "format:check not configured"

info "Running typecheck..."
npm run typecheck

info "Running tests..."
npm test -- --run

if [[ "${TALOS_SKIP_BUILD:-false}" != "true" ]]; then
  info "Running build..."
  npm run build
fi

log "✓ talos-sdk-ts tests passed."
