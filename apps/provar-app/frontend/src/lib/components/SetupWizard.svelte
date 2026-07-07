<script lang="ts">
  import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-svelte';
  import { settingsStore } from '../stores/settings-store.svelte';
  import { projectStore } from '../stores/project-store.svelte';
  import { Dialog, Project } from '../api';
  import { domain } from '../../../wailsjs/go/models';

  type Step = 'provider' | 'apikey' | 'project';
  let step = $state<Step>('provider');

  let provider = $state('openai');
  let apiKey = $state('');
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  async function saveAndAdvance() {
    if (!apiKey.trim()) {
      saveError = 'API key is required';
      return;
    }
    saving = true;
    saveError = null;
    try {
      const settings = (await Project.Settings()) ?? new domain.Settings();
      settings.Provider = provider;
      // Ensure the active provider's entry exists; the domain's
      // defaultSettings populates all three, but defensive in case a
      // future save stripped it.
      if (!settings.Providers) settings.Providers = {};
      if (!settings.Providers[provider]) {
        settings.Providers[provider] = {
          Model: '',
          APIKey: apiKey.trim(),
          BaseURL: '',
        };
      } else {
        settings.Providers[provider].APIKey = apiKey.trim();
      }
      await Project.SaveSettings(settings);
      step = 'project';
    } catch (e) {
      console.error('Setup wizard: save settings failed:', e);
      saveError = (e as Error).message;
    } finally {
      saving = false;
    }
  }

  async function pickFirstProject() {
    try {
      const path = await Dialog.SelectProject();
      if (!path) return;
      await projectStore.openProject(path);
      settingsStore.dismissSetupWizard();
    } catch (e) {
      console.error('Setup wizard: project pick failed:', e);
    }
  }

  function finish() {
    settingsStore.dismissSetupWizard();
  }
</script>

<div
  class="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center px-6"
  data-testid="setup-wizard"
>
  <div class="w-full max-w-xl">
    <header class="mb-6 text-center">
      <div
        class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"
      >
        <Sparkles class="h-6 w-6" />
      </div>
      <h1 class="mb-2 text-2xl font-semibold text-zinc-100">Welcome to Provar</h1>
      <p class="text-sm text-zinc-400">Let's get you set up. Three quick steps.</p>
    </header>

    <div class="rounded-xl border border-zinc-800 bg-[#161b22]/80 p-6 backdrop-blur-md">
      {#if step === 'provider'}
        <h2 class="mb-1 text-sm font-semibold text-zinc-100">Pick a provider</h2>
        <p class="mb-4 text-xs text-zinc-500">The model that authors your test code.</p>
        <div class="space-y-2">
          {#each ['openai', 'anthropic', 'google'] as p}
            <button
              type="button"
              class="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors {provider ===
              p
                ? 'border-blue-500 bg-blue-500/10 text-zinc-100'
                : 'border-zinc-700 text-zinc-300 hover:border-zinc-600'}"
              onclick={() => (provider = p)}
            >
              <span class="font-mono text-xs">{p}</span>
            </button>
          {/each}
        </div>
        <div class="mt-6 flex justify-end">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            onclick={() => (step = 'apikey')}
          >
            Next
            <ArrowRight class="h-3.5 w-3.5" />
          </button>
        </div>
      {:else if step === 'apikey'}
        <h2 class="mb-1 text-sm font-semibold text-zinc-100">API key</h2>
        <p class="mb-4 text-xs text-zinc-500">Stored locally in ~/.provar/settings.yml.</p>
        <input
          type="password"
          bind:value={apiKey}
          placeholder="sk-…"
          class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-2.5 font-mono text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        {#if saveError}
          <p class="mt-2 text-xs text-red-400">{saveError}</p>
        {/if}
        <div class="mt-6 flex justify-between">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            onclick={() => (step = 'provider')}
          >
            <ArrowLeft class="h-3.5 w-3.5" />
            Back
          </button>
          <button
            type="button"
            disabled={saving}
            class="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-60"
            onclick={saveAndAdvance}
          >
            {saving ? 'Saving…' : 'Next'}
            <ArrowRight class="h-3.5 w-3.5" />
          </button>
        </div>
      {:else}
        <h2 class="mb-1 text-sm font-semibold text-zinc-100">First project</h2>
        <p class="mb-4 text-xs text-zinc-500">Point Provar at a directory with a web app.</p>
        <div class="space-y-2">
          <button
            type="button"
            class="w-full rounded-lg border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:border-blue-500"
            onclick={pickFirstProject}
          >
            Open a folder…
          </button>
          <button
            type="button"
            class="w-full rounded-lg border border-zinc-800 px-3 py-2 text-left text-sm text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
            onclick={finish}
          >
            Skip for now
          </button>
        </div>
        <div class="mt-6 flex justify-start">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            onclick={() => (step = 'apikey')}
          >
            <ArrowLeft class="h-3.5 w-3.5" />
            Back
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>