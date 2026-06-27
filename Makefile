# Provar Makefile
#
# Convenience targets around the standard Go toolchain. Each target calls Go directly —
# no custom wrappers, no magic. The default `all` target runs the verification steps that
# AGENTS.md and .agents/skills/coding/SKILL.md require before declaring work done.

BINARY := bin/provar

.PHONY: all fmt vet test build run install tidy clean help
all: fmt vet test build

fmt:
	go fmt ./...

vet:
	go vet ./...

test:
	go test ./...

build:
	go build -o $(BINARY) ./apps/provar-cli/cmd/provar

run: build
	./$(BINARY) $(ARGS)

install:
	go install ./apps/provar-cli/cmd/provar

tidy:
	go mod tidy

clean:
	rm -rf bin/

help:
	@echo "Targets:"
	@echo "  all       fmt + vet + test + build"
	@echo "  fmt       go fmt ./..."
	@echo "  vet       go vet ./..."
	@echo "  test      go test ./..."
	@echo "  build     compile the provar CLI binary to bin/provar"
	@echo "  run       build and run the CLI (use ARGS='...' to pass flags)"
	@echo "  install   install the CLI to $$GOPATH/bin"
	@echo "  tidy      go mod tidy"
	@echo "  clean     remove bin/"
