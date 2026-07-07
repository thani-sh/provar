<script lang="ts">
  import Welcome from "./lib/components/Welcome.svelte";
</script>

<div
  class="relative h-screen w-full overflow-hidden overscroll-none bg-[rgba(14,17,22,0.7)] font-sans text-zinc-300"
>
  <div
    class="absolute top-0 right-0 left-0 z-40 h-[56px]"
    style="--wails-draggable:drag"
  ></div>
  <Welcome
    homeDir=""
    recentProjects={[]}
    onOpen={() => {}}
    onError={(m) => console.warn(m)}
  />
</div>