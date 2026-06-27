# Provar: Roadmap

Where the rewrite stands and the sequenced path to a usable product.

---

## 1. Current State

The runtime engine exists in `libs/sdk`. The CLI is a stub. The other reserved surfaces are empty.

## 2. Path to Provar CLI v1

Four phases, sequenced.

- **scenario io**: read scenarios from disk, write compiled code to disk.
- **settings**: per-user provider config that gates compilation.
- **subcommands**: setup, compile, and runner wired up as the user-facing CLI.
- **release**: documented, installable, citable.

## 3. Path to Graphical Editor v1

Three phases, sequenced.

- **canvas**: visual graph editor for composing scenarios.
- **debugger**: run scenarios from the editor with live browser state.
- **release**: packaged desktop app.
