<script lang="ts">
	import { onMount } from "svelte";

	type Props = {
		src: string;
		alt: string;
		// Native pixel dimensions of the source image — used to reserve the
		// correct box before the image loads so the layout doesn't jump.
		width: number;
		height: number;
		// Fade the image in once it has loaded. Useful for hero shots where
		// you don't want a hard pop-in. Cached images are handled in onMount
		// since `load` won't fire after the fact.
		fadeIn?: boolean;
		fadeDuration?: number;
		rounded?: boolean;
		eager?: boolean;
		objectPosition?: "top" | "center" | "bottom" | "left" | "right" | string;
		class?: string;
	};

	let {
		src,
		alt,
		width,
		height,
		fadeIn = true,
		fadeDuration = 500,
		rounded = true,
		eager = true,
		objectPosition = "top",
		class: extraClass = ""
	}: Props = $props();

	let ready = $state(false);
	let imgEl: HTMLImageElement | null = $state(null);

	function onLoad() {
		ready = true;
	}

	onMount(() => {
		if (imgEl?.complete) ready = true;
	});
</script>

<figure
	class="relative overflow-hidden {rounded ? 'rounded-xl' : ''} {extraClass}"
	style="aspect-ratio: {width} / {height};"
>
	<img
		bind:this={imgEl}
		{src}
		{alt}
		{width}
		{height}
		onload={onLoad}
		loading={eager ? "eager" : "lazy"}
		decoding="async"
		class="block h-full w-full object-cover transition-opacity {fadeIn
			? ready
				? 'opacity-100'
				: 'opacity-0'
			: ''}"
		style="transition-duration: {fadeDuration}ms; object-position: {objectPosition};"
	/>
</figure>
