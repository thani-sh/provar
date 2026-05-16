<script lang="ts">
	import { Sparkles, Send } from 'lucide-svelte';

	let { 
  }: { 
  } = $props();

  let message = $state('');

  function handleSend() {
    if (!message.trim()) return;
    console.log('AI Assistant: Triggering model with message:', message);
    message = '';
  }
</script>

<aside
	class="absolute top-8 right-2 bottom-2 z-50 flex w-[400px] flex-col rounded-xl border border-zinc-800/80 bg-[#161b22]/50 shadow-2xl backdrop-blur-md"
>
	<div class="flex items-center justify-between border-b border-zinc-800/50 p-6">
		<div class="flex items-center gap-2">
			<Sparkles size={20} class="text-indigo-400" />
			<h2 class="text-xl font-medium text-zinc-100">AI Assistant</h2>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6 space-y-4">
    <div class="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
      <p class="text-sm leading-relaxed text-zinc-300">
        I'm here to help you build and refine your tests. You can ask me to:
      </p>
      <ul class="mt-3 space-y-2 text-xs text-zinc-400 list-disc list-inside">
        <li>Generate new test steps based on a description</li>
        <li>Refactor existing test flows</li>
        <li>Add assertions to your nodes</li>
        <li>Explain how a test suite works</li>
      </ul>
    </div>

    <div class="flex-1"></div>
	</div>

  <div class="p-4 border-t border-zinc-800/50">
    <div class="relative">
      <textarea
        bind:value={message}
        placeholder="Type your request here..."
        class="w-full bg-[#0d1117] border border-zinc-700/50 rounded-lg p-3 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
        onkeydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      ></textarea>
      <button
        onclick={handleSend}
        disabled={!message.trim()}
        class="absolute right-2 bottom-2 p-1.5 rounded-md bg-indigo-500 text-white disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors"
      >
        <Send size={16} />
      </button>
    </div>
    <p class="mt-2 text-[10px] text-zinc-500 text-center">
      AI can make mistakes. Check important info.
    </p>
  </div>
</aside>
