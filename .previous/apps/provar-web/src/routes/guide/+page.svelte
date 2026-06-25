<svelte:head>
	<title>5-minute quickstart — Provar</title>
	<meta
		http-equiv="refresh"
		content="0; url=/docs/quickstart"
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<script>
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";

	// Fallback for browsers / crawlers that ignore <meta http-equiv="refresh">: do a
	// client-side nav to the canonical quickstart. `/docs/quickstart` is the home of the
	// 5-minute guide; `/guide` exists only to catch any old external links.
	onMount(() => {
		goto("/docs/quickstart", { replaceState: true });
	});
</script>

<div class="border-outline-variant/30 border-b">
	<div class="mx-auto flex h-14 max-w-3xl items-center px-6">
		<a
			href="/"
			class="font-mono text-sm font-semibold tracking-tight text-on-surface"
		>
			<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span><span
				class="text-on-surface-variant">guide</span
			>
		</a>
	</div>
</div>

<div class="mx-auto max-w-3xl px-6 py-10">
	<article class="docs-prose">
		<h1>5-minute quickstart</h1>
		<p>
			This guide has moved to <a href="/docs/quickstart">/docs/quickstart</a>. Redirecting
			now — if your browser does not follow the redirect automatically, use the link above.
		</p>
	</article>
</div>
