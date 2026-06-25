# Provar Web

Static product website for [Provar](https://github.com/thani-sh/provar). Built with SvelteKit +
`adapter-static` so the entire site is pre-rendered to plain HTML/CSS/JS and can be hosted on any
static CDN.

## Stack

- SvelteKit 2 (Svelte 5)
- `@sveltejs/adapter-static` — full SSG
- Tailwind v4 (design tokens driven by `docs/DESIGN.md`)
- Geist + JetBrains Mono

## Develop

```sh
bun install
bun run dev
```

## Build

```sh
bun run build
```

Static output lands in `build/`.

## Layout

```
src/
  app.css                 # Tailwind v4 + design tokens
  app.html                # base shell, font preloads
  routes/
    +layout.svelte        # header, footer, dotted-grid backdrop
    +layout.ts            # prerender = true
    +page.svelte          # home: hero, features, download, GitHub
  lib/
    components/           # shared components (reserved for later)
static/
  favicon.svg
```
