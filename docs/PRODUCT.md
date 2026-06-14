# Provar — Product Specification (Living)

This document is the **single source of truth for what Provar is and who it's for**. It is a living
specification: it changes whenever the product's purpose, audience, surface area, or north-star
metric changes. It is **not** a release-by-release changelog and **not** an implementation log.

For the elevator pitch see [README.md](../README.md). For non-obvious design decisions see
[docs/adrs/](adrs/). For product-decision history see [docs/pdrs/](pdrs/). For the contributor
rules see [AGENTS.md](../AGENTS.md).

> **Editing rule:** change this file only when the *purpose* of the product changes, not when a
> feature is added. New features go in a PDR; the affected section here gets a one-line update at
> most. If you find yourself rewriting more than a paragraph, the change is probably a PDR first,
> PRODUCT.md second.

---

## 1. What Provar is

Provar is a **Git-native, AI-assisted, local-only end-to-end testing tool** for web applications.

A developer designs a test as a directed graph of user-facing steps on a visual canvas. Provar's
agent observes the live page state and writes the underlying browser automation. Test files, baselines,
and configuration live in the project repository alongside the application code. Tests run on the
developer's machine and in CI without any cloud dependency.

The product is the combination of:

1. A **graphical editor** (`apps/provar-app`) — a desktop app for authoring and debugging tests
   visually.
2. A **command-line interface** (`apps/provar-cli`) — for running tests headlessly in CI, scripting,
   and power users who prefer the terminal.
3. A **runnable engine** (`libs/engine` + `libs/models`) — the same core that powers both the app
   and the CLI.
4. A **product website with user guide** (`apps/provar-web`) — the entry point for new users and the
   home of the end-user documentation.

## 2. Who it is for

**Primary audience: a working web developer** who has a real application, knows the basics of
end-to-end testing, and wants to author tests without hand-writing brittle selectors or giving up
their code to a cloud service. They are comfortable with a terminal, an editor, and Git. They are
not a QA specialist and not a non-technical stakeholder.

**Adjacent audience: a small-team tech lead** evaluating local-sovereignty testing for compliance
or security reasons, and a solo developer who wants AI-assisted test maintenance without
uploading their app to a third party.

**Explicitly not for:**

- Non-developers. The product assumes comfort with a code editor and a terminal.
- Mobile or native-desktop apps. Web only, in this phase.
- Teams that need a hosted multi-user collaboration product. Provar is local-first; multi-user
  collaboration happens through Git, not through a shared server.
- Users who want a fully no-code tool. The AI removes the need to hand-write selectors, but the
  YAML test file and the engine output are first-class artifacts that the user can read and edit.

## 3. Core concepts (canonical terminology)

These are the words the product, the documentation, the marketing copy, and the user-facing UI all
agree on. Code-internal type names (`Task`, `Graph`, `Path`, `File`) may use the engineering-flavored
synonyms — see ADR for the rationale — but every user-facing surface uses the words below.

| Concept | User-facing term | One-line definition |
|---|---|---|
| A folder containing the app under test and its `.provar/` directory | **project** | The root that holds your tests and runs them. |
| One user-facing action in a test (click, type, assert, navigate) | **step** | A single thing the test does. |
| A node-to-node sequence through the graph, topologically ordered | **path** | One way the test can run; diamond graphs have multiple. |
| A recorded screenshot of a step's outcome, used for visual diffing | **snapshot** | The "this is what it looked like when it passed" image. |
| The recorded snapshot a new run is compared against | **baseline** | The approved reference image; updated on intent. |
| The visual canvas the developer authors steps on | **canvas** | Where you draw the test. |
| A run of one path through the graph | **run** | One execution attempt. |
| The full project-wide execution of every path | **test run** | All paths, one after another. |

If a new user-facing word appears in the app, the CLI, or the docs, add it to this table in the
same change.

## 4. Surface area

The product ships as four units. Each unit has a single, non-overlapping role.

| Unit | Path | Role | Audience |
|---|---|---|---|
| `apps/provar-app` | Desktop editor | Author and debug tests visually | Primary surface for the primary audience |
| `apps/provar-cli` | `provar` command | Run tests headlessly, CI integration | CI pipelines, power users |
| `apps/provar-web` | Static site | Marketing, downloads, end-user guide | New users, evaluators |
| `thani-sh/demo-social` | External sandbox app | Target for the sample project, quickstart, and examples | Documentation, sample-project smoke test |

The four libraries (`libs/config`, `libs/domain`, `libs/engine`, `libs/models`) are **internal
implementation**, not product surface. They are not separately published, not separately installed,
not part of the public API. They appear in this spec only to define the boundary between "product"
and "internals."

## 5. Guiding principles

Every product decision should be testable against this list. If a change violates one, either the
change is wrong or the principle is wrong — and the principle is much harder to change.

1. **Local by default.** Tests, baselines, configuration, and generated code live on the
   developer's machine and in their Git repository. Nothing leaves the developer's machine without
   an explicit action that the developer can audit.
2. **Git-native.** A test file is a YAML file. A baseline is a PNG in the repo. A config is JSON.
   Diffs are PRs. There is no proprietary binary blob that needs a Provar server to read.
3. **AI serves the developer.** The agent writes the brittle parts (selectors, assertions) so the
   developer can stay at the intent level. The generated code is visible, editable, and reviewable.
   The developer is always in the loop before a baseline is accepted.
4. **Self-healing is a feature, not magic.** When the app changes, the agent can re-generate the
   affected steps. The developer reviews the diff. Provar never silently overwrites a test in CI
   to make a build pass.
5. **One engine, three faces.** The desktop app, the CLI, and the website are thin layers over
   the same engine. A test that runs in the app runs in the CLI. A test that runs in the CLI runs
   in CI. There is exactly one set of "what a passing test means" semantics.
6. **Beginner to advanced in the same product.** A new user gets a sample project, an in-app
   tour, and a guided first run. An advanced user gets the CLI, scripted runs, env-var
   substitution, and a curated engine API. Both use the same editor, the same files, the same
   engine. There is no "lite mode."

## 6. North-star metric

**Time from `bun install` to first passing test run.**

This is measured end-to-end for a developer who has never used Provar, following only the
end-user guide on `apps/provar-web`. The target for the current phase is **under 30 minutes**.
Sub-5-minute time-to-first-run against the cloned sample project is the leading indicator.

Secondary metrics (for visibility, not gating):

- Number of test files per active project (depth of adoption beyond the sample).
- Number of baselines accepted per week per active project (signal that visual diffing is in
  use, not just present).
- Median time from a UI change to a regenerated, reviewed step (the self-healing loop working).

Anti-metrics (numbers we are explicitly not optimizing for):

- Concurrent users on a hosted product. There is no hosted product.
- Number of supported LLM providers beyond what is documented in the AI-provider setup guide. A
  long provider list is a maintenance liability, not a feature.

## 7. Current phase

**Phase: pre-user, single-developer.** Provar is in early development with no active external
users. The product owner is the developer, the user is the developer, the support channel is the
developer. Every decision in this phase optimizes for *the next person who clones the repo* being
able to get to a passing test without help.

The exit criterion for this phase is **a documented, repeatable, sub-30-minute path from a clean
clone to a passing test run against the user's own application** (not the cloned sample). The
end-user guide on `apps/provar-web`, the in-app empty state in `apps/provar-app`, and the
`provar init` style flow are the artifacts that make this exit real.

## 8. Documentation system

The docs in this repository are organized so each kind lives in one place and the place is
predictable. Use this map when adding or finding a doc.

| Doc | Where | What belongs there | When it changes |
|---|---|---|---|
| Elevator pitch | [README.md](../README.md) | What is Provar in 30 seconds, the 4 key features | Rarely — only when the pitch changes |
| Living spec | [docs/PRODUCT.md](PRODUCT.md) (this file) | Who, what, why, surface area, principles, north-star, phase | Only when the *purpose* changes |
| Architecture decision | [docs/adrs/](adrs/) | A single non-obvious technical choice and its rationale | Once per decision, append-only |
| Product decision | [docs/pdrs/](pdrs/) | A single non-obvious product choice and its rationale | Once per decision, append-only |
| Design system | [docs/DESIGN.md](DESIGN.md) | Tokens, components, type scale, motion, accessibility | When the design system changes |
| Work log / known issues | [docs/TODOS.md](TODOS.md) | Open issues, refactor tasks, audit findings | Continuously — this is the only "in motion" doc |
| End-user guide | `apps/provar-web/src/routes/docs/` | How to install, run, author, and troubleshoot | When a user-facing flow changes |
| Contributor rules | [AGENTS.md](../AGENTS.md) | Tooling, version control, monorepo layout, naming | When the contributor workflow changes |
| Library / app README | `<unit>/README.md` | Per-unit build and dev instructions | When the unit's build changes |

If you are about to add a `.md` file and you can't point at one row above, **stop and add a row to
this table first** (or update the row that should hold it). The goal is that any contributor can
find the right doc by thinking for 5 seconds about which row it belongs in.

## 9. Screenshot and asset convention

All screenshots in product documentation, READMEs, and the end-user guide use one image as a
**placeholder** until the real screenshot is captured:

> **Placeholder path:** `docs/imgs/screenshot.png`
>
> When a doc needs a screenshot but the real capture is not yet available, reference this file
> with a clear caption that names the eventual subject, e.g.
> `![Editor canvas with a 4-step login test](docs/imgs/screenshot.png)` with a TODO note above
> the figure saying "replace with the actual canvas screenshot once available."

Real screenshots, when captured, live in the doc that uses them under a local `img/` folder
(e.g. `apps/provar-web/static/docs/img/`) and are committed alongside the change that needs them.
The placeholder file is never deleted; it remains the universal "screenshot not yet captured"
marker.

## 10. Versioning

The product is in pre-1.0 development. Per [AGENTS.md](../AGENTS.md), breaking API changes are
preferred over backward-compatibility shims. The `apps/provar-cli` does not yet have a stable
public surface; the `@libs/*` packages are internal to this monorepo and are **not** published
to npm. The `@provar/cli` package name is reserved for the eventual public release of the CLI
when it stabilizes — until then, install is via `bun --cwd apps/provar-cli` or a future
`provar.se/install.sh`.
