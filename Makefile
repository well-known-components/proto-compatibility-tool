
ifneq ($(CI), true)
LOCAL_ARG = --local --verbose --diagnostics
endif

test: build
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha $(TESTARGS)
	./dist/bin.js test/test-api.proto test/test-api.proto
	./dist/bin.js test/test-api.proto test/test-api-v1.proto
	# ./dist/bin.js test/test-api.proto https://raw.githubusercontent.com/well-known-components/proto-compatibility-tool/main/test/test-api.proto

test-watch:
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha --watch $(TESTARGS)

build:
	./node_modules/.bin/tsc -p tsconfig.json
	rm -rf node_modules/@microsoft/api-extractor/node_modules/typescript || true
	./node_modules/.bin/api-extractor run $(LOCAL_ARG) --typescript-compiler-folder ./node_modules/typescript
	chmod +x dist/bin.js

.PHONY: build test