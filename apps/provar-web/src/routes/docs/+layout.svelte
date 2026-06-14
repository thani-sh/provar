<script lang="ts">
	import { page } from "$app/state";

	let { children } = $props();

	const sections = [
		{
			title: "Get started",
			items: [
				{ href: "/docs", label: "Overview" },
				{ href: "/docs/quickstart", label: "Quickstart" }
			]
		},
		{
			title: "Products",
			items: [
				{ href: "/docs/products/provar-app", label: "provar-app" },
				{ href: "/docs/products/provar-cli", label: "provar-cli" }
			]
		},
		{
			title: "Day-to-day",
			items: [
				{ href: "/docs/authoring", label: "Authoring tests" },
				{ href: "/docs/running", label: "Running tests" },
				{ href: "/docs/ci", label: "CI integration" }
			]
		},
		{
			title: "Help",
			items: [{ href: "/docs/troubleshooting", label: "Troubleshooting" }]
		}
	];

	function isActive(href: string, current: string): boolean {
		if (href === "/docs") return current === "/docs";
		return current === href || current.startsWith(href + "/");
	}
</script>

<div class="border-outline-variant/30 border-b">
	<div class="mx-auto flex h-14 max-w-6xl items-center px-6">
		<a
			href="/docs"
			class="font-mono text-sm font-semibold tracking-tight text-on-surface"
		>
			<span class="text-primary">provar</span><span class="text-on-surface-variant">/</span><span
				class="text-on-surface-variant">docs</span
			>
		</a>
		<a
			href="/"
			class="border-outline-variant text-on-surface hover:bg-surface-container ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
		>
			<span aria-hidden="true">←</span>
			<span>back to overview</span>
		</a>
	</div>
</div>

<div class="mx-auto max-w-6xl px-6 py-10">
	<div class="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
		<aside class="lg:sticky lg:top-6 lg:self-start">
			<nav aria-label="Documentation">
				{#each sections as section (section.title)}
					<div class="mb-6">
						<h3
							class="text-on-surface-variant mb-2 text-[11px] font-semibold tracking-wider uppercase"
						>
							{section.title}
						</h3>
						<ul class="space-y-1">
							{#each section.items as item (item.href)}
								{@const active = isActive(item.href, page.url.pathname)}
								<li>
									<a
										href={item.href}
										aria-current={active ? "page" : undefined}
										class="block rounded-md px-2 py-1.5 text-sm transition-colors {active
											? 'bg-primary-container/30 text-primary font-medium'
											: 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/60'}"
									>
										{item.label}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</nav>
		</aside>

		<article class="docs-prose max-w-3xl">
			{@render children()}
		</article>
	</div>
</div>
