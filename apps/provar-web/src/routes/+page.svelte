<script lang="ts">
	const features = [
		{
			title: "Flow-based logic",
			body: "User journeys are rarely linear. Map tests as visual flowcharts with branching, so the structure of a test matches the structure of the product."
		},
		{
			title: "AI-assisted design",
			body: "Describe a step in plain language. The agent reads the live page state, picks elements, writes assertions, and self-heals when the UI shifts."
		},
		{
			title: "Local & Git-native",
			body: "Everything lives in your repo — flows, config, generated code. No cloud uploads, no vendor lock-in, runs the same in CI as on your laptop."
		},
		{
			title: "Made for developers",
			body: "A real local editor, real test files, real git diffs. The visual clarity of low-code without giving up the power of code-based testing."
		}
	];

	const downloadLinks = [
		{
			os: "macOS",
			subtitle: "Apple Silicon & Intel",
			file: "provar-desktop.dmg",
			href: "https://github.com/thani-sh/provar/releases/latest"
		},
		{
			os: "Windows",
			subtitle: "x64",
			file: "provar-desktop.exe",
			href: "https://github.com/thani-sh/provar/releases/latest"
		},
		{
			os: "Linux",
			subtitle: "AppImage · deb · rpm",
			file: "provar-desktop.AppImage",
			href: "https://github.com/thani-sh/provar/releases/latest"
		}
	];

	const installCommand = "curl -fsSL https://provar.se/install.sh | bash";
</script>

<svelte:head>
	<title>Provar — local, Git-native end-to-end testing</title>
</svelte:head>

<!-- HERO -->
<section class="hero-glow">
	<div class="mx-auto max-w-6xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
		<div
			class="border-outline-variant/40 bg-surface-container-low/40 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
		>
			<span class="bg-primary inline-block h-1.5 w-1.5 rounded-full"></span>
			<span class="text-on-surface-variant font-mono tracking-tight">
				open source · early access
			</span>
		</div>

		<h1
			class="mt-6 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl md:text-6xl"
		>
			Draw your tests.<br />
			<span class="text-primary">Let a helper do the fiddly bits.</span>
		</h1>

		<p class="text-on-surface-variant mt-6 max-w-2xl text-lg leading-relaxed">
			Provar turns the journeys people take through your app into a visual map you can read
			at a glance. You sketch the route, an assistant handles the clicks and the checks, and
			everything stays on your machine.
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
				$ bun add -g @apps/provar-cli &nbsp;·&nbsp; or grab the desktop app below
			</p>
		</div>

		<figure class="mt-16">
			<img
				src="/screenshot.png"
				alt="Provar canvas showing a visual flow of an end-to-end test"
				class="block w-full rounded-xl"
				loading="eager"
				decoding="async"
			/>
		</figure>
	</div>
</section>

<!-- FEATURES -->
<section class="border-outline-variant/30 border-y">
	<div class="mx-auto max-w-6xl px-6 py-20 sm:py-24">
		<div class="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
			{#each features as f, i (f.title)}
				<div
					class="bg-surface-container-low hover:bg-surface-container flex flex-col gap-3 rounded-lg p-6 transition-colors"
				>
					<div class="flex items-center gap-2">
						<span class="text-primary font-mono text-xs">0{i + 1}</span>
						<div class="bg-outline-variant/60 h-px w-6"></div>
					</div>
					<h3 class="text-on-surface text-base font-semibold">{f.title}</h3>
					<p class="text-on-surface-variant text-sm leading-relaxed">{f.body}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- DOWNLOAD -->
<section id="download" class="scroll-mt-16">
	<div class="mx-auto max-w-6xl px-6 py-20 sm:py-28">
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
			{/each}
		</div>

		<!-- CLI install -->
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
