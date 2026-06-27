# 002 - Sample Project Uses a Live-Hosted Demo

## Context

PDR-011 (in `.previous/docs/pdrs/011-clone-sample-project-from-external-repo.md`) decided the sample project shipped with the Provar CLI would come from `git clone https://github.com/thani-sh/demo-social.git`. The Go migration initially preserved this — the v1 of the CLI plan called for `InitProject --sample` to shell out to `git clone` via `os/exec`.

The north-star metric in `docs/ROADMAP.md` §5 is "time from cloning/install to first passing test, under 30 minutes." A `git clone` of `demo-social` then `npm install` then `npm start` adds 5–10 minutes of setup most new users won't tolerate. A live-hosted demo with a passing test in 30 seconds is the difference between a quickstart that converts and one that doesn't.

## Decision

The sample is served from a live hosted instance at `https://demo.thani.sh/`. `InitProject --sample` writes two template files into the new project:

- `.provar/config.yml` with `baseUrl: https://demo.thani.sh/`
- `.provar/tests/login.test.yml` with a 4-action login flow against the demo

No `git clone`. No `os/exec`. No local node/npm prerequisite for trying the sample. The implementation is pure `os.WriteFile` of two template strings.

This supersedes PDR-011. The trade-offs below replace the reasoning in that PDR.

## Consequences

**Pros**

- Time-to-first-passing-test drops from 5–10 minutes to ~30 seconds.
- No local prerequisites — no node, no npm, no git-for-clone — just the Provar binary and internet.
- Implementation collapses: the planned `cloneSample` helper, `os/exec` invocation, partial-clone cleanup, and `SampleRepoURL` constant all disappear.
- The sample is always the latest demo. No local clone to refresh.

**Cons**

- Network is required at `provar run` time (not at scaffold time — that's still offline-friendly).
- Operational risk: `demo.thani.sh`'s uptime and structural stability are on the critical path for every new user's first-run experience. A demo redesign (login flow change, dashboard markup shift) breaks the sample for everyone.
- `docs/PRODUCT.md` §1 says tests "run entirely locally or in CI without cloud dependency." The sample now has a cloud dependency, even if it's opt-in via `--sample`.
- Test flakiness from a real hosted service (network blips, server restarts, demo changes) reaches new users.

**Mitigations**

- The sample test asserts the broadest possible signals ("page loaded + post-login marker present"), not fine-grained CSS, so cosmetic demo changes don't break it.
- The sample is updated in lockstep with demo changes — tracked as a release checklist item, not automated.
- `docs/PRODUCT.md` gets a one-line carve-out so the "no cloud dependency" principle is preserved for user-authored tests; the sample is a separate concern.
- The non-sample path (`provar setup` without `--sample`) is unchanged — it writes an empty skeleton that runs against whatever local URL the user configures. If `demo.thani.sh` is down, users can still scaffold and point at their own app.

A `git clone` fallback was considered and rejected. Adding a second code path for sample delivery doubles the maintenance surface and re-introduces the node/npm prerequisite the live demo was chosen to eliminate.

See `docs/plans/provar-cli.md` §2.1 (`init.go`) for the implementation shape and §7 for the PRODUCT.md carve-out.
