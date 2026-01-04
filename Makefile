# Universal Makefile Interface
all: install lint test build conformance
.PHONY: install typecheck lint format test coverage conformance build clean

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

coverage:
	# Generate report
	npm run coverage

coverage-check:
	# Enforce 80% threshold (excluding harness)
	npx vitest run --coverage --coverage.exclude=**/conformance.ts --coverage.exclude=**/test_vectors/** --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.branches=80 --coverage.thresholds.statements=80

conformance:
	# Run conformance vectors
	@echo "Running conformance tests..."
	# Passing args to npm script requires --
	npm test -w @talosprotocol/sdk -- tests/vectors.test.ts

build:
	npm run build

clean:
	rm -rf dist node_modules packages/*/dist packages/*/node_modules
