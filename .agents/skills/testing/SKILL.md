---
name: testing
description: Guidelines for compiling, running, and writing Go unit and integration tests.
---

# Testing & Verification Guide

Every feature, package, and bug fix must be covered by robust Go unit or integration tests.

## Writing Tests

- **Test Files**: Place test files next to the code they verify, naming them `*_test.go`.
- **Idiomatic Testing**: Use Go's standard `testing` package. Prefer table-driven tests for testing multiple input/output scenarios.
- **Mocking & Isolation**: Mock external network or filesystem interactions to ensure tests run fast and locally without side effects.
- **Edge Cases**: Ensure test coverage checks happy paths, validation errors, and boundary/edge cases.

## Running Tests

- Run all tests in the workspace:
  ```bash
  go test ./...
  ```
- Run tests in a specific package:
  ```bash
  go test ./libs/sdk/engine
  ```
- Run a specific test with verbose output:
  ```bash
  go test -v -run TestCompileEngine ./libs/sdk/engine
  ```
