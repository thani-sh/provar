<script lang="ts">
  import { projectStore } from '../stores/project-store.svelte';
</script>

<div
  class="absolute top-0 right-0 left-0 z-30 flex h-9 items-center gap-3 border-b border-zinc-800/50 px-3 pt-[28px] text-xs text-zinc-400"
>
  <span class="font-mono">{projectStore.path ?? 'No project'}</span>
  <span class="text-zinc-600">·</span>
  <span>Toolbar</span>
</div>