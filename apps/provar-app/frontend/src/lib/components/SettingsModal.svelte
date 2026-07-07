<script lang="ts">
  import Modal from './Modal.svelte';
  import { uiStore } from '../stores/ui-store.svelte';

  let provider = $state('openai');
  let apiKey = $state('');

  function save() {
    // TODO: persist via Settings binding once it exists.
    console.log('Settings saved (stub):', { provider, apiKey });
    uiStore.modalKind = null;
  }
</script>

<Modal
  show={uiStore.modalKind === 'settings'}
  title="Settings"
  primaryLabel="Save"
  onPrimary={save}
  onClose={() => (uiStore.modalKind = null)}
>
  <div class="space-y-4 text-sm">
    <div>
      <label class="mb-1 block text-xs text-zinc-500" for="settings-provider">Provider</label>
      <select
        id="settings-provider"
        bind:value={provider}
        class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-2.5 text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      >
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="google">Google</option>
      </select>
    </div>
    <div>
      <label class="mb-1 block text-xs text-zinc-500" for="settings-key">API Key</label>
      <input
        id="settings-key"
        type="password"
        bind:value={apiKey}
        placeholder="sk-…"
        class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-2.5 font-mono text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      />
    </div>
  </div>
</Modal>