# Universal Makefile Interface
all: install lint test build conformance

install:
	npm install

typecheck:
	# Language specific type check
	npm run typecheck

lint:
	# Style + Types (Fail on error)
	npm run lint

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
