<script lang="ts">
  import { uiStore } from '../stores/ui-store.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import ConfigModal from './ConfigModal.svelte';
  import ConfirmModal from './ConfirmModal.svelte';
  import InputModal from './InputModal.svelte';
</script>

<SettingsModal />
<ConfigModal />

<!-- ConfirmModal and InputModal are wired via uiStore directly when opened
     — for v1 they're called imperatively by callers that pass props inline.
     Phase 9 full integration: replace imperative calls with the global
     modalKind dispatch. -->

{#if uiStore.modalKind === 'confirm'}
  <ConfirmModal
    show={true}
    title="Confirm"
    message="Are you sure?"
    onConfirm={() => (uiStore.modalKind = null)}
    onCancel={() => (uiStore.modalKind = null)}
  />
{/if}

{#if uiStore.modalKind === 'input'}
  <InputModal
    show={true}
    title="Input"
    placeholder="Enter value"
    onConfirm={() => (uiStore.modalKind = null)}
    onCancel={() => (uiStore.modalKind = null)}
  />
{/if}