# 007 - Automated Path Resolution for Branching

## Context

When a test graph contains decision points or branches, it's unclear whether to run a single test that makes choices or multiple tests representing each path.

## Decision

The system will **resolve all possible paths** from the start node to the end nodes and produce isolated Playwright tests for each distinct execution route.

## Consequences

- Comprehensive coverage of all possible user journeys within a graph.
- Isolated test results for each path, making failures easier to pinpoint.
- Avoids complex conditional logic within a single executable test script.
