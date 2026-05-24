# Provar CLI

The command-line interface for the Provar AI-driven End-to-End Test Engine. It compiles visual graph definitions (`.test.yml`) into native, high-performance Playwright test execution scripts (`.test.ts`) and executes them.

## Quick Start

1. Install dependencies from the monorepo root:
   ```bash
   bun install
   ```

2. Compile visual test graphs:
   ```bash
   provar compile <test-file-path|dir>
   ```

3. Run compiled test suites:
   ```bash
   provar run <test-file-path|dir> [options]
   ```
   *Options include `--up-to <actionId>` to execute up to a specific action and `--headless <true|false>`.*
