# Documentation style guide

This file is the conventions reference for anyone writing a page under `apps/provar-web/src/routes/docs/`. It is intentionally short — six rules, one example block. The point is that a new contributor can read this once and produce a page that matches the rest of the guide.

## 1. Use the terms from `docs/PRODUCT.md` § 3

| Use | Don't use |
|---|---|
| project | workspace, repo (in a Provar context) |
| step | task, action, operation |
| path | flow, scenario, run |
| snapshot | screenshot, capture, image |
| baseline | reference, golden image |
| canvas | graph editor, visual editor |
| run | execution, invocation |

The engineering-flavored synonyms `Task`, `Graph`, `Path`, `File` may appear in code, type names, and JSDoc — they are the canonical internal types. User-facing copy uses the words above.

## 2. Every code block has a header

A bare shell snippet is a tutorial smell. Use a `pre><code>` block with a one-line comment header naming the file or shell context:

```ts
// .provar/config.yml
variables:
  baseUrl: http://127.0.0.1:6001
```

```sh
# from your project root
bun --cwd apps/provar-app dev
```

## 3. Every screenshot is a placeholder until it isn't

Until the real screenshot is captured, use the shared `<DocsPlaceholder caption="..." />` component. It renders `docs/imgs/screenshot.png` (copied to `static/docs/img/screenshot.png` at build time) with a "Replace before publishing" notice.

When the real screenshot is available, replace the component call with a plain `<figure><img src="..." />` block — never leave the placeholder in a published page.

## 4. Anchor names use the heading text

`h2` headings become in-page anchors for the table of contents. The anchor is the kebab-case of the heading text. If you rename a heading, search the page for its old anchor and update the links.

## 5. Link to the source when describing engine behavior

If a page documents a behavior that comes from the engine, libs, or CLI, link to the relevant file at the top of the section so a curious reader can verify. Example:

> The path enumeration algorithm is implemented in [`libs/engine/src/loader.ts`](https://github.com/thani-sh/provar/blob/main/libs/engine/src/loader.ts).

## 6. Don't promise features that aren't shipped

If the install page says `provar.se/install.sh` will work, the URL must work today. Until the one-line installer ships, the home page gates that block behind `PUBLIC_INSTALL_LIVE=false` (see `src/lib/build-info.ts`). The install page must follow the same flag.

The same rule applies to CI matrixes, supported providers, and exit codes. The exit-code table on `/docs/running` is the canonical reference — if you add a new exit code, update that table in the same change.
