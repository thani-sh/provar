<script lang="ts">
  import { projectStore } from '../stores/project-store.svelte';
  import { uiStore } from '../stores/ui-store.svelte';
  import Modal from './Modal.svelte';

  let variablesJson = $state('{}');

  $effect(() => {
    const cfg = projectStore.config as { variables?: Record<string, unknown> } | null;
    variablesJson = JSON.stringify(cfg?.variables ?? {}, null, 2);
  });

  function save() {
    let vars: Record<string, unknown> = {};
    try {
      vars = JSON.parse(variablesJson);
    } catch {
      // For v1 we just no-op on bad JSON — Phase 9 full validation lands later.
      return;
    }
    projectStore.saveConfig({ ...projectStore.config, variables: vars });
    uiStore.modalKind = null;
  }
</script>

<Modal
  show={uiStore.modalKind === 'config'}
  title="Project Config"
  primaryLabel="Save"
  onPrimary={save}
  onClose={() => (uiStore.modalKind = null)}
>
  <div>
    <label class="mb-1 block text-xs text-zinc-500" for="config-vars">Variables (JSON)</label>
    <textarea
      id="config-vars"
      bind:value={variablesJson}
      rows="8"
      class="w-full rounded-lg border border-zinc-700/50 bg-[#21262d] p-2.5 font-mono text-xs text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
    ></textarea>
  </div>
</Modal>