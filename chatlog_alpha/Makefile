BINARY_NAME := chatlog
BIN := bin/$(BINARY_NAME)
GO := go
GO_TAGS := -tags sqlite_fts5
RUN_ARGS ?=
BUILD_SCRIPT := scripts/build_chatlog_binary.sh
VERIFY_SCRIPT := scripts/verify_chatlog_binary.sh
RELEASE_SCRIPT := scripts/build_release_macos.sh
GO_SOURCES := $(shell find . -type f -name '*.go' -not -path './.git/*')
EMBEDDED_ASSETS := $(shell find internal -type f \( -name '*.htm' -o -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.py' -o -name '*.wasm' -o -name '*.sh' -o -name '*.yaml' -o -name '*.yml' \))

ifeq ($(VERSION),)
	VERSION := $(shell git describe --tags --always --dirty='-dev' 2>/dev/null || echo unknown)
endif

.PHONY: all clean fmt-check vet tidy build run release

all: fmt-check vet build

clean:
	@echo "🧹 Cleaning generated outputs..."
	@rm -rf bin/ dist/ release/

fmt-check:
	@echo "🎨 Checking Go formatting..."
	@test -z "$$(gofmt -l $$(find . -type f -name '*.go' -not -path './.git/*'))"

vet:
	@echo "🔎 Running static checks..."
	CGO_ENABLED=1 $(GO) vet $(GO_TAGS) ./...

tidy:
	@echo "🧼 Tidying dependencies..."
	$(GO) mod tidy

build: $(BIN)

$(BIN): $(GO_SOURCES) $(EMBEDDED_ASSETS) go.mod go.sum $(BUILD_SCRIPT) $(VERIFY_SCRIPT)
	@echo "🔨 Building for current macOS architecture..."
	@CHATLOG_VERSION="$(VERSION)" $(BUILD_SCRIPT) $(BIN)

run: build
	@echo "🚀 Starting the Web console..."
	@exec ./$(BIN) $(RUN_ARGS)

release:
	@echo "📦 Building macOS amd64/arm64 release archives..."
	@RELEASE_VERSION="$(VERSION)" $(RELEASE_SCRIPT)
