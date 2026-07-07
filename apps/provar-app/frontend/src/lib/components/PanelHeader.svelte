<script lang="ts">
  interface Props {
    title: string;
    children?: import('svelte').Snippet;
  }
  let { title, children }: Props = $props();
</script>

<header
  class="flex items-center justify-between border-b border-zinc-800/50 px-6 pt-3 pb-4"
>
  <h2 class="text-sm font-semibold text-zinc-200">{title}</h2>
  {#if children}{@render children()}{/if}
</header>