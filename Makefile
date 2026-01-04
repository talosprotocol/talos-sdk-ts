# talos-sdk-ts Makefile
# TypeScript SDK for Talos Protocol

.PHONY: install build test lint clean start stop

# Default target
all: install build test

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm ci

# Build
build:
	@echo "Building..."
	npm run build

# Run tests
test:
	@echo "Running tests..."
	npm test -- --run

# Lint check
lint:
	@echo "Running lint..."
	npm run lint
	npm run typecheck

# Clean all generated files and dependencies
clean:

format:
	# Auto-fix style
	npm run format
	npm run lint:fix

test:
	# Unit tests
	npm run test

conformance:
	# Run conformance vectors
	@echo "Running conformance tests..."
	# Passing args to npm script requires --
	npm test -w @talosprotocol/sdk -- tests/vectors.test.ts

build:
	npm run build

clean:
	rm -rf dist node_modules packages/*/dist packages/*/node_modules


# Doctor check
doctor:
	@echo "Checking environment..."
	@node --version || echo "Node.js missing"
	@npm --version || echo "npm missing"
	@[ -d "node_modules" ] && echo "node_modules detected" || echo "No node_modules"

# Scripts wrapper
start:
	@./scripts/start.sh

stop:
	@./scripts/stop.sh
