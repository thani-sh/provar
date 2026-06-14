<script lang="ts">
  import { ProvarAPI } from "../../api/provar";
  import type { Settings } from "@libs/config";

  interface Props {
    show: boolean;
    onClose: () => void;
  }

  let { show, onClose }: Props = $props();

  // Three screens, one question at a time. 0 = welcome, 1 = provider, 2 = done.
  let step = $state(0);
  let isSaving = $state(false);

  // Provider form state. We bind directly into a settings-shaped object so
  // we can hand it straight to saveSettings() at the end.
  let provider = $state<Settings["models"]["defaultProvider"]>(
    "google-generative-ai",
  );
  let apiKey = $state("");
  let baseUrl = $state("");
  let model = $state("");

  // Track whether the user actually configured a provider on step 1, so step 2
  // ("Done") can give a useful summary.
  let providerChosen = $state(false);

  // Reset state when the wizard opens so the user always gets a clean run.
  $effect(() => {
    if (show) {
      step = 0;
      isSaving = false;
      provider = "google-generative-ai";
      apiKey = "";
      baseUrl = "";
      model = "";
      providerChosen = false;
    }
  });

  // Default the per-provider model field when the provider changes, so the
  // user only has to type their key.
  $effect(() => {
    if (provider === "openai") {
      model = model || "gpt-4o";
    } else if (provider === "google-generative-ai") {
      model = model || "gemini-1.5-flash";
    }
  });

  async function finish(includeProvider: boolean) {
    isSaving = true;
    try {
      const settings: Partial<Settings> = {};
      if (includeProvider && provider) {
        settings.models = {
          defaultProvider: provider,
          providers: {
            openai: {
              apiKey: provider === "openai" ? apiKey : "",
              model: provider === "openai" ? model : "gpt-4o",
              baseUrl: provider === "openai" ? baseUrl : "",
            },
            "google-generative-ai": {
              apiKey: provider === "google-generative-ai" ? apiKey : "",
              model:
                provider === "google-generative-ai"
                  ? model
                  : "gemini-1.5-flash",
            },
          },
        };
      }
      await ProvarAPI.saveSettings(settings);
      onClose();
    } catch (e) {
      console.error("SetupWizard: failed to save settings:", e);
    } finally {
      isSaving = false;
    }
  }

  function handleNext() {
    if (step === 0) step = 1;
    else if (step === 1) {
      providerChosen = true;
      step = 2;
    } else if (step === 2) finish(providerChosen);
  }

  // Skipping from step 1: don't mark the provider as configured, just close
  // the wizard with default settings. Same path as the "Open Provar" button
  // on the done screen when the user lands there after skipping.
  function handleSkip() {
    finish(false);
  }
</script>

<!--
  The wizard replaces the regular landing ("Recent Projects" / "Open project...")
  while it's visible. We use the whole window so the step indicator can sit
  flush at the top and the action buttons can sit in the bottom-right corner.
-->
{#if show}
  <div class="relative flex h-full w-full flex-col text-zinc-300">
    <!-- Step indicator pinned to the top of the window -->
    <div class="flex items-center justify-center px-4 pt-4">
      <div class="flex items-center gap-2">
        {#each [0, 1, 2] as i}
          <span
            class="h-1.5 w-6 rounded-full transition-colors {i === step
              ? 'bg-indigo-500'
              : i < step
                ? 'bg-indigo-500/40'
                : 'bg-zinc-700'}"
          ></span>
        {/each}
      </div>
    </div>

    <!-- Step content centered in the remaining space -->
    <div
      class="flex flex-1 items-center justify-center overflow-y-auto px-6 pb-24"
    >
      <div class="flex w-full max-w-lg flex-col items-center text-center">
        {#if step === 0}
          <h1 class="text-2xl font-semibold text-zinc-100">
            Welcome to Provar
          </h1>
          <ul class="mt-6 w-full space-y-2 text-left text-sm text-zinc-300">
            <li class="flex gap-3">
              <span class="text-zinc-500">·</span>
              <span>Sketch user journeys as branching flowcharts.</span>
            </li>
            <li class="flex gap-3">
              <span class="text-zinc-500">·</span>
              <span
                >Describe steps in plain language and the agent does the rest.</span
              >
            </li>
            <li class="flex gap-3">
              <span class="text-zinc-500">·</span>
              <span>Flows, config, and code all live in your repo.</span>
            </li>
            <li class="flex gap-3">
              <span class="text-zinc-500">·</span>
              <span>Real test files, real diffs, no cloud uploads.</span>
            </li>
          </ul>
        {:else if step === 1}
          <h2 class="text-lg font-semibold text-zinc-100">
            Connect an AI Provider
          </h2>
          <p class="mt-1 text-xs text-zinc-500">
            The assistant and visual baselines need a key.
          </p>

          <div class="mt-6 w-full space-y-4 text-left">
            <div>
              <label
                for="wizard-provider"
                class="mb-1.5 block text-xs font-medium tracking-wider text-zinc-500 uppercase"
              >
                Provider
              </label>
              <select
                id="wizard-provider"
                bind:value={provider}
                class="w-full appearance-none rounded-lg border border-zinc-700/50 bg-[#21262d] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_1rem_center] bg-no-repeat px-4 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="google-generative-ai">Google</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label
                for="wizard-apikey"
                class="mb-1.5 block text-xs font-medium text-zinc-500"
              >
                API Key
              </label>
              <input
                id="wizard-apikey"
                type="text"
                bind:value={apiKey}
                class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                placeholder={provider === "openai" ? "sk-..." : "AIzaSy..."}
              />
            </div>

            <div>
              <label
                for="wizard-model"
                class="mb-1.5 block text-xs font-medium text-zinc-500"
              >
                Model
              </label>
              <input
                id="wizard-model"
                type="text"
                bind:value={model}
                class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                placeholder={provider === "openai"
                  ? "gpt-4o"
                  : "gemini-1.5-flash"}
              />
            </div>

            {#if provider === "openai"}
              <div>
                <label
                  for="wizard-baseurl"
                  class="mb-1.5 block text-xs font-medium text-zinc-500"
                >
                  Base URL <span class="text-zinc-600">(optional)</span>
                </label>
                <input
                  id="wizard-baseurl"
                  type="text"
                  bind:value={baseUrl}
                  class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            {/if}
          </div>
        {:else}
          <div
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 class="mt-4 text-lg font-semibold text-zinc-100">
            You're all set
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-zinc-400">
            {#if providerChosen}
              Provar is configured to use
              <span class="font-medium text-zinc-200"
                >{provider === "openai" ? "OpenAI" : "Google"}</span
              >
              with model
              <span class="font-medium text-zinc-200">{model}</span>.
            {:else}
              You skipped the AI provider. Provar will work, but the assistant
              and visual baselines will be disabled until you add a key in
              Settings.
            {/if}
          </p>
          <p class="mt-2 text-xs text-zinc-500">
            You can change any of this later from the app menu.
          </p>
        {/if}
      </div>
    </div>

    <!-- Action buttons pinned to the bottom-right corner -->
    <div class="absolute right-6 bottom-6 flex items-center gap-2">
      {#if step === 1}
        <button
          onclick={handleSkip}
          class="rounded-lg px-4 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200 focus:outline-none"
        >
          Skip
        </button>
      {/if}
      <button
        onclick={handleNext}
        disabled={isSaving}
        class="rounded-lg border border-zinc-800/80 bg-[#161b22]/50 px-4 py-2.5 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-700 hover:bg-[#21262d]/50 hover:text-zinc-200 focus:outline-none disabled:opacity-50"
      >
        {step === 2 ? (isSaving ? "Saving..." : "Open Provar") : "Next"}
      </button>
    </div>
  </div>
{/if}
