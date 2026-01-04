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
	@echo "Cleaning..."
	rm -rf node_modules
	rm -rf dist build out
	rm -rf .next .turbo
	rm -rf coverage
	rm -rf .eslintcache
	@echo "Clean complete. Ready for fresh build."

# Conformance test
conformance:
	@echo "Running conformance tests..."
	@echo "Running conformance tests..."
	npm test -w @talosprotocol/sdk -- tests/vectors.test.ts

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
