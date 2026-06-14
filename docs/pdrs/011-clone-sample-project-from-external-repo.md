# 011 - clone the sample project from an external repo

## Context

The Provar editor's empty-state screen offers a "Create sample project" action so a brand-new
user can go from "just installed the app" to "ran my first passing test" without first cloning
anything by hand. Two options were available for sourcing that sample:

- **Bundle the sample inside the editor** — keep a stripped-down `apps/provar-app/sample-projects/`
  tree that the editor copies into a destination folder.
- **Clone an external repo at runtime** — point the editor at a public repo (currently
  `https://github.com/thani-sh/demo-social`) and `git clone` it into the destination folder.

Bundling has the appeal of a single artifact: a user who downloads the editor is one click away
from a working project. In practice it also (a) duplicates the demo app's source into two places
that drift, (b) inflates the editor binary, and (c) hides the fact that the sample is a real
project on its own — contributors can't easily propose fixes or new sample tests via PR.

The demo-social repo already exists and is the canonical home of the sandbox app, its seed
credentials, and its `.provar/` test definitions. Keeping the source of truth in one place —
and having the editor fetch from it on demand — is cheaper to maintain, smaller to ship, and
gives the sample a public issue tracker.

## Decision

The empty-state "Create sample project" action will:

1. Prompt the user to pick a destination folder (native folder picker, same as today).
2. Run `git clone https://github.com/thani-sh/demo-social.git <destination>/demo-social`.
3. Open `<destination>/demo-social` as the active project.

The bundled `apps/provar-app/sample-projects/` tree is removed. The shared RPC handler that
implemented the copy is replaced with a `git clone`-based implementation. Errors (missing git,
network failure, destination already exists) surface to the user as a toast and leave no
partial clone behind.

## Consequences

- **Smaller editor binary.** The sample project is no longer in the bundle. The trade-off is a
  network round-trip on first use, which is acceptable for a desktop tool.
- **Single source of truth.** The sample app, its `.provar/` config, and any future examples all
  live in `thani-sh/demo-social` and are maintained alongside the rest of the Provar ecosystem
  (see PRODUCT.md § 4 surface area — `demo-social` is now an external unit, not an `apps/`
  member).
- **Git is a hard runtime dependency for the editor.** Already true (every Provar project is a
  Git repo), so this is a no-op for the user.
- **Updates flow through the upstream repo.** When the sample app or its tests change, users
  who re-clone get the latest version automatically — no editor release needed.
- **Offline first-run is no longer guaranteed.** A user with no network on first launch will
  see an error. Documented as a known limitation in the guide; the alternative (hand-cloning
  the repo) is one command.
