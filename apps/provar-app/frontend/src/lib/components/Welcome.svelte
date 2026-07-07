<script lang="ts">
  import {
    Plus,
    FolderOpen,
    Sparkles,
    BookOpen,
    ArrowRight,
  } from "lucide-svelte";

  interface Props {
    homeDir: string;
    recentProjects: string[];
    onOpen: (path: string) => void;
    onError: (message: string) => void;
  }

  let { homeDir, recentProjects, onOpen, onError }: Props = $props();

  let busy = $state(false);

  function displayPath(p: string): string {
    return p.startsWith(homeDir) ? p.replace(homeDir, "~") : p;
  }

  // TODO: wire to Go-side commands once the backend lands. The welcome page
  // renders before the ProvarAPI exists, so these are visual placeholders.
  function pickExisting() {
    onError("Coming soon: open a folder from your file system.");
  }

  async function createSample() {
    if (busy) return;
    busy = true;
    try {
      onError("Coming soon: clone the sample project.");
    } finally {
      busy = false;
    }
  }
</script>

<div
  class="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center px-6"
  data-testid="empty-state"
>
  <div class="w-full max-w-2xl">
    <header class="mb-8 text-center">
      <div
        class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"
      >
        <Sparkles class="h-6 w-6" />
      </div>
      <h1 class="mb-2 text-2xl font-semibold text-zinc-100">
        Welcome to Provar
      </h1>
      <p class="text-sm text-zinc-400">
        Start by picking a project, or clone the sample project to run a passing
        test in under five minutes.
      </p>
    </header>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <button
        onclick={createSample}
        disabled={busy}
        class="group flex flex-col items-start gap-3 rounded-xl border border-zinc-800 bg-[#161b22] p-5 text-left transition-all hover:border-blue-500/60 hover:bg-[#1c2128] disabled:opacity-60"
        data-testid="empty-state-create-sample"
      >
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400"
        >
          <Plus class="h-4 w-4" />
        </div>
        <div>
          <h2 class="mb-1 text-sm font-semibold text-zinc-100">
            Create sample project
          </h2>
          <p class="text-xs text-zinc-400">
            Clones the demo-social sample (a 5-step login test + a local web
            app) into a folder of your choice.
          </p>
        </div>
        <span
          class="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 transition-transform group-hover:translate-x-0.5"
        >
          Get started
          <ArrowRight class="h-3 w-3" />
        </span>
      </button>

      <button
        onclick={pickExisting}
        class="group flex flex-col items-start gap-3 rounded-xl border border-zinc-800 bg-[#161b22] p-5 text-left transition-all hover:border-zinc-700 hover:bg-[#1c2128]"
        data-testid="empty-state-open-folder"
      >
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700/30 text-zinc-300"
        >
          <FolderOpen class="h-4 w-4" />
        </div>
        <div>
          <h2 class="mb-1 text-sm font-semibold text-zinc-100">
            Open a folder
          </h2>
          <p class="text-xs text-zinc-400">
            Point at any folder that contains a web app. Provar will create
            <code class="rounded bg-zinc-800/60 px-1 py-0.5 text-[11px]"
              >.provar/</code
            >
            for you on first save.
          </p>
        </div>
      </button>
    </div>

    {#if recentProjects.length > 0}
      <section class="mt-8">
        <h3
          class="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase"
        >
          Recent
        </h3>
        <ul class="space-y-1">
          {#each recentProjects as path (path)}
            <li>
              <button
                onclick={() => onOpen(path)}
                class="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-800 hover:bg-[#161b22]"
                title={path}
              >
                <FolderOpen class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span class="truncate font-mono text-xs"
                  >{displayPath(path)}</span
                >
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <footer
      class="mt-10 flex items-center justify-center gap-2 text-xs text-zinc-500"
    >
      <BookOpen class="h-3.5 w-3.5" />
      <a
        href="https://provar.se/docs/quickstart"
        target="_blank"
        rel="noopener noreferrer"
        class="transition-colors hover:text-zinc-300"
        >Read the 5-minute quickstart</a
      >
    </footer>
  </div>
</div>