<script lang="ts">
	import { onMount } from "svelte";
	import Image from "$lib/components/Image.svelte";
	import { buildInfo } from "$lib/build-info";

	// Hero copy alternatives — each pair: imperative action / what the AI does.
	// Picked at random on every page load. Hardcoded list; tweak in source.
	const heroLines: ReadonlyArray<{ primary: string; accent: string }> = [
		{ primary: "Map the journey.", accent: "AI handles the rest." },
		{ primary: "Sketch the flow.", accent: "AI writes the code." },
		{ primary: "Plot the path.", accent: "AI walks it for you." },
		{ primary: "Describe the test.", accent: "Watch it build itself." },
		{ primary: "Chart the steps.", accent: "The machine does the rest." },
		{ primary: "Draw the route.", accent: "AI learns the rest." }
	];

	// Start with the first option so the prerendered HTML has a real h1 for
	// crawlers and no-JS users. We hide it visually until the client has
	// picked a random variant and is ready to fade in — that way JS users
	// never see a flash of the SSR'd text being swapped out.
	let heroIndex = $state(0);
	let heroReady = $state(false);

	onMount(() => {
		heroIndex = Math.floor(Math.random() * heroLines.length);
		heroReady = true;
	});

	const releasesHref = `${buildInfo.githubRepo}/releases/latest`;

	const downloadLinks = [
		{
			os: "macOS",
			subtitle: "Apple Silicon & Intel",
			file: "provar-desktop.dmg",
			href: releasesHref,
			status: "available" as const
		},
		{
			os: "Windows",
			subtitle: "x64",
			file: "provar-desktop.exe",
			href: releasesHref,
			status: "coming-soon" as const
		},
		{
			os: "Linux",
			subtitle: "AppImage · deb · rpm",
			file: "provar-desktop.AppImage",
			href: releasesHref,
			status: "coming-soon" as const
		}
	];

	const installCommand = `curl -fsSL ${buildInfo.installBase}/install.sh | bash`;
</script>

<svelte:head>
	<title>Provar — local, git-native end-to-end testing</title>
</svelte:head>

<!-- HERO -->
<section class="hero-glow">
	<div class="mx-auto max-w-6xl px-6 pt-24 pb-6 sm:pt-32 sm:pb-8">
		<div
			class="border-outline-variant/40 bg-surface-container-low/40 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
		>
			<span class="bg-primary inline-block h-1.5 w-1.5 rounded-full"></span>
			<span class="text-on-surface-variant font-mono tracking-tight">
				open source · early access
			</span>
		</div>

		<h1
			class="mt-6 text-4xl leading-[1.1] font-semibold tracking-tight transition-opacity duration-400 sm:text-5xl md:text-6xl {heroReady
				? 'opacity-100'
				: 'opacity-0'}"
		>
			{heroLines[heroIndex].primary}<br />
			<span class="text-primary">{heroLines[heroIndex].accent}</span>
		</h1>

		<p class="text-on-surface-variant mt-6 max-w-2xl text-lg leading-relaxed">
			End-to-end tests shouldn't fall apart every time a button moves. Provar turns each
			user journey into a visual flow you can sketch, inspect, and version in git — then
			an AI agent picks the selectors, writes the assertions, and self-heals when the UI
			shifts. Runs locally, in CI, with no cloud account required.
		</p>

		<div class="mt-10 flex flex-wrap items-center gap-3">
			<a
				href="#download"
				class="bg-primary text-on-primary hover:bg-primary-container inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
			>
				Download for free
				<span aria-hidden="true">↓</span>
			</a>
			<a
				href="https://github.com/thani-sh/provar"
				target="_blank"
				rel="noopener noreferrer"
				class="border-outline-variant text-on-surface hover:bg-surface-container inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
			>
				View on GitHub
				<span aria-hidden="true">↗</span>
			</a>
		</div>

		<div class="mt-12 max-w-3xl">
			<div class="beam"></div>
			<p class="text-on-surface-variant/70 mt-3 font-mono text-xs">
				$ npm install -g @provar/provar-cli &nbsp;·&nbsp; or grab the desktop app below
			</p>
		</div>

		<Image
			src="/screenshot.png"
			alt="Provar canvas showing a visual flow of an end-to-end test"
			width={3644}
			height={2370}
			class="mt-16"
		/>
	</div>
</section>

<!-- DOWNLOAD -->
<section id="download" class="scroll-mt-16">
	<div class="mx-auto max-w-6xl px-6 py-10 sm:py-14">
		<div class="flex flex-col gap-2">
			<span class="text-primary font-mono text-xs tracking-widest uppercase">
				download
			</span>
			<h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
				Pick a package to get started.
			</h2>
			<p class="text-on-surface-variant mt-2 max-w-2xl text-sm leading-relaxed">
				Provar is free and open source. The desktop app bundles the visual editor; the
				CLI is enough if you'd rather drive everything from a terminal.
			</p>
		</div>

		<div class="mt-10 grid gap-4 sm:grid-cols-3">
			{#each downloadLinks as d (d.os)}
				{#if d.status === "available"}
					<a
						href={d.href}
						target="_blank"
						rel="noopener noreferrer"
						class="group border-outline-variant/60 bg-surface-container-low hover:border-primary/60 flex flex-col gap-3 rounded-xl border p-6 transition-colors"
					>
						<div class="flex items-center justify-between">
							<span class="text-on-surface text-lg font-semibold">{d.os}</span>
							<span
								class="text-on-surface-variant group-hover:text-primary text-sm transition-colors"
								aria-hidden="true">↓</span
							>
						</div>
						<p class="text-on-surface-variant text-xs">{d.subtitle}</p>
						<p class="text-outline font-mono text-xs">{d.file}</p>
					</a>
				{:else}
					<div
						aria-disabled="true"
						class="border-outline-variant/30 bg-surface-container-lowest/40 flex cursor-not-allowed flex-col gap-3 rounded-xl border p-6 opacity-50"
					>
						<div class="flex items-center justify-between">
							<span class="text-on-surface text-lg font-semibold">{d.os}</span>
							<span
								class="bg-outline-variant/30 text-on-surface-variant rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider"
							>
								coming soon
							</span>
						</div>
						<p class="text-on-surface-variant text-xs">{d.subtitle}</p>
						<p class="text-outline font-mono text-xs">{d.file}</p>
					</div>
				{/if}
			{/each}
		</div>

		<!-- CLI install: gated behind PUBLIC_INSTALL_LIVE. Until the one-line installer ships,
		     show a "coming soon" card and a docs link instead of a 404-ing command. -->
		{#if buildInfo.installLive}
			<div
				class="border-outline-variant/40 bg-surface-container-lowest mt-8 overflow-hidden rounded-xl border"
			>
				<div
					class="border-outline-variant/40 flex items-center justify-between border-b px-4 py-2"
				>
					<span class="text-on-surface-variant font-mono text-xs">terminal</span>
					<span class="text-outline font-mono text-xs">install via curl</span>
				</div>
				<pre
					class="text-on-surface overflow-x-auto p-4 font-mono text-sm leading-relaxed"><code
						><span class="text-outline">$</span> {installCommand}</code
					></pre>
			</div>
		{:else}
			<div
				class="border-outline-variant/40 bg-surface-container-lowest mt-8 flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between"
			>
				<div>
					<p class="text-on-surface text-sm font-semibold">
						One-line installer is coming soon.
					</p>
					<p class="text-on-surface-variant mt-1 text-xs">
						In the meantime, follow the manual steps on the install page — the quickstart
						gets you to a passing test in under five minutes.
					</p>
				</div>
				<a
					href="/docs/install"
					class="border-outline-variant text-on-surface hover:bg-surface-container inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
				>
					Read the install guide
					<span aria-hidden="true">→</span>
				</a>
			</div>
		{/if}

		<p class="text-on-surface-variant mt-4 text-xs">
			All builds are published on the
			<a
				href="https://github.com/thani-sh/provar/releases"
				target="_blank"
				rel="noopener noreferrer"
				class="text-primary hover:underline">GitHub releases page</a
			>. Checksums and signatures are included.
		</p>
	</div>
</section>

<!-- CTA -->
<section class="border-outline-variant/30 border-t">
	<div class="mx-auto max-w-6xl px-6 py-20 sm:py-24">
		<div
			class="bg-surface-container-low border-outline-variant/40 flex flex-col items-start gap-6 rounded-2xl border p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10"
		>
			<div class="max-w-xl">
				<h3 class="text-xl font-semibold tracking-tight">
					Open source. Open roadmap.
				</h3>
				<p class="text-on-surface-variant mt-2 text-sm leading-relaxed">
					Provar is built in the open. File issues, send PRs, or just watch it being
					built — your call.
				</p>
			</div>
			<div class="flex flex-wrap gap-3">
				<a
					href="https://github.com/thani-sh/provar"
					target="_blank"
					rel="noopener noreferrer"
					class="bg-primary text-on-primary hover:bg-primary-container inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
				>
					Star on GitHub
					<span aria-hidden="true">↗</span>
				</a>
				<a
					href="https://github.com/thani-sh/provar/blob/main/README.md"
					target="_blank"
					rel="noopener noreferrer"
					class="border-outline-variant text-on-surface hover:bg-surface-container inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
				>
					Read the README
				</a>
			</div>
		</div>
	</div>
</section>
