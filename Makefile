.PHONY: install build test clean start

install:
	npm install

build:
	npm run build

test:
	npm test

clean:
	rm -rf node_modules packages/*/dist packages/*/node_modules

# Fetches upstream vectors (Phase 8 Requirement)
vectors:
	./scripts/fetch_vectors.sh

start:
	./start.sh
