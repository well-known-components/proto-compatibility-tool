
ifneq ($(CI), true)
LOCAL_ARG = --local --verbose --diagnostics
endif

test: build
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha $(TESTARGS)
	./dist/bin.js

test-watch:
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha --watch $(TESTARGS)

build:
	./node_modules/.bin/tsc -p tsconfig.json
	rm -rf node_modules/@microsoft/api-extractor/node_modules/typescript || true
	./node_modules/.bin/api-extractor run $(LOCAL_ARG) --typescript-compiler-folder ./node_modules/typescript
	chmod +x dist/bin.js

.PHONY: build test