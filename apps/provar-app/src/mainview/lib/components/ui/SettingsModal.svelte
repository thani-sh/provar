<script lang="ts">
  import { ProvarAPI } from "../../api/provar";
  import type { Settings } from "@libs/settings";

  interface Props {
    show: boolean;
    onClose: () => void;
  }

  let { show, onClose }: Props = $props();

  let activeSection = $state<"general" | "models">("general");
  let settings = $state<Settings | null>(null);
  let isSaving = $state(false);

  $effect(() => {
    if (show) {
      ProvarAPI.getSettings()
        .then((res) => {
          settings = JSON.parse(JSON.stringify(res.settings));
        })
        .catch((err) => {
          console.error("Failed to load settings:", err);
        });
    }
  });

  async function handleSave() {
    if (!settings) return;
    isSaving = true;
    try {
      await ProvarAPI.saveSettings(settings);
      onClose();
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      isSaving = false;
    }
  }
</script>

{#if show && settings}
  <div
    class="fixed inset-0 z-[400] flex overflow-hidden bg-[#161b22] text-zinc-300 select-none"
  >
    <!-- Sidebar Panel -->
    <aside
      class="w-[200px] shrink-0 border-r border-zinc-800 bg-[#0e1116]/40 p-6 pt-[50px]"
    >
      <h2
        class="mb-4 px-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase"
      >
        Settings
      </h2>
      <nav class="space-y-1">
        <button
          onclick={() => (activeSection = "general")}
          class="electrobun-webkit-app-region-no-drag w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 focus:outline-none {activeSection ===
          'general'
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200'}"
        >
          General
        </button>
        <button
          onclick={() => (activeSection = "models")}
          class="electrobun-webkit-app-region-no-drag w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 focus:outline-none {activeSection ===
          'models'
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200'}"
        >
          Models
        </button>
      </nav>
    </aside>

    <!-- Main Config Panel -->
    <main class="flex min-w-0 flex-1 flex-col px-8 pt-[50px] pb-8">
      <div class="flex-1 overflow-y-auto pr-1">
        {#if activeSection === "general"}
          <div class="max-w-xl space-y-6">
            <div>
              <h3 class="text-base font-semibold text-zinc-100">
                General Settings
              </h3>
              <p class="mt-1 text-xs text-zinc-500">
                Configure general application preferences.
              </p>
            </div>

            <div>
              <label
                for="placeholder-setting"
                class="mb-2 block text-xs font-medium tracking-wider text-zinc-500 uppercase"
              >
                Placeholder Setting
              </label>
              <input
                id="placeholder-setting"
                type="text"
                bind:value={settings.placeholder}
                class="electrobun-webkit-app-region-no-drag w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                placeholder="Enter placeholder value..."
              />
            </div>
          </div>
        {:else if activeSection === "models"}
          <div class="max-w-xl space-y-6">
            <div>
              <h3 class="text-base font-semibold text-zinc-100">
                Model Configuration
              </h3>
              <p class="mt-1 text-xs text-zinc-500">
                Configure API credentials and model configurations.
              </p>
            </div>

            <div>
              <label
                for="default-provider"
                class="mb-2 block text-xs font-medium tracking-wider text-zinc-500 uppercase"
              >
                Default AI Provider
              </label>
              <select
                id="default-provider"
                bind:value={settings.models.defaultProvider}
                class="electrobun-webkit-app-region-no-drag w-full appearance-none rounded-lg border border-zinc-700/50 bg-[#21262d] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_1rem_center] bg-no-repeat px-4 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="google-generative-ai"
                  >Google Generative AI</option
                >
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div class="space-y-4 border-t border-zinc-800 pt-4">
              <h4
                class="text-xs font-semibold tracking-wider text-zinc-400 uppercase"
              >
                Provider Parameters
              </h4>

              {#if settings.models.defaultProvider === "openai"}
                <div class="space-y-4">
                  <div>
                    <label
                      for="openai-apikey"
                      class="mb-1.5 block text-xs font-medium text-zinc-500"
                    >
                      API Key
                    </label>
                    <input
                      id="openai-apikey"
                      type="text"
                      bind:value={settings.models.providers.openai.apiKey}
                      class="electrobun-webkit-app-region-no-drag w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      placeholder="sk-..."
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        for="openai-model"
                        class="mb-1.5 block text-xs font-medium text-zinc-500"
                      >
                        Model Name
                      </label>
                      <input
                        id="openai-model"
                        type="text"
                        bind:value={settings.models.providers.openai.model}
                        class="electrobun-webkit-app-region-no-drag w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        for="openai-baseurl"
                        class="mb-1.5 block text-xs font-medium text-zinc-500"
                      >
                        Base URL (Optional)
                      </label>
                      <input
                        id="openai-baseurl"
                        type="text"
                        bind:value={settings.models.providers.openai.baseUrl}
                        class="electrobun-webkit-app-region-no-drag w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        placeholder="https://api.openai.com/v1"
                      />
                    </div>
                  </div>
                </div>
              {:else if settings.models.defaultProvider === "google-generative-ai"}
                <div class="space-y-4">
                  <div>
                    <label
                      for="google-apikey"
                      class="mb-1.5 block text-xs font-medium text-zinc-500"
                    >
                      API Key
                    </label>
                    <input
                      id="google-apikey"
                      type="text"
                      bind:value={
                        settings.models.providers["google-generative-ai"].apiKey
                      }
                      class="electrobun-webkit-app-region-no-drag w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      placeholder="AIzaSy..."
                    />
                  </div>

                  <div>
                    <label
                      for="google-model"
                      class="mb-1.5 block text-xs font-medium text-zinc-500"
                    >
                      Model Name
                    </label>
                    <input
                      id="google-model"
                      type="text"
                      bind:value={
                        settings.models.providers["google-generative-ai"].model
                      }
                      class="electrobun-webkit-app-region-no-drag w-full rounded-lg border border-zinc-700/50 bg-[#21262d] px-4 py-2 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Action Footer -->
      <div
        class="electrobun-webkit-app-region-no-drag mt-6 flex shrink-0 items-center justify-end gap-3 border-t border-zinc-800 pt-4"
      >
        <button
          onclick={onClose}
          class="rounded-lg border border-zinc-800 bg-[#21262d] px-4 py-2 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-800 focus:outline-none active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          onclick={handleSave}
          disabled={isSaving}
          class="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-600 focus:outline-none active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </main>
  </div>
{/if}
