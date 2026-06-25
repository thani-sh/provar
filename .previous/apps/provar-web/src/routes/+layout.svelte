<script lang="ts">
	import "../app.css";
	import { page } from "$app/state";
	import { buildInfo } from "$lib/build-info";

	let { children } = $props();

	const nav = [
		{ href: "/", label: "Overview" },
		{ href: "/docs", label: "Docs" },
		{ href: "/#download", label: "Download" }
	];

	const isDocs = $derived(page.url.pathname.startsWith("/docs"));
</script>

<div class="dot-grid min-h-dvh">
	{#if !isDocs}
		<header class="border-outline-variant/40 border-b">
			<div
				class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6"
			>
				<a
					href="/"
					class="font-mono text-sm font-semibold tracking-tight text-on-surface"
				>
					<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span><span
						class="text-on-surface-variant">se</span
					>
				</a>

				<nav class="flex items-center gap-1 text-sm">
					{#each nav as item (item.href)}
						<a
							href={item.href}
							class="text-on-surface-variant hover:text-on-surface rounded-md px-3 py-1.5 transition-colors"
						>
							{item.label}
						</a>
					{/each}
					<a
						href={buildInfo.githubRepo}
						target="_blank"
						rel="noopener noreferrer"
						class="text-on-surface-variant hover:text-on-surface ml-2 rounded-md px-3 py-1.5 transition-colors"
					>
						GitHub ↗
					</a>
				</nav>
			</div>
		</header>
	{/if}

	<main>
		{@render children()}
	</main>

	<footer class="border-outline-variant/30 mt-24 border-t">
		<div
			class="text-on-surface-variant mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs sm:flex-row sm:items-center sm:justify-between"
		>
			<p>
				<span class="font-mono">provar</span> — local, git-native end-to-end testing.
			</p>
			<p class="font-mono">
				{new Date().getFullYear()} · <a
					href={buildInfo.githubRepo}
					class="hover:text-on-surface underline-offset-4 hover:underline">thani-sh/provar</a
				>
			</p>
		</div>
	</footer>
</div>
