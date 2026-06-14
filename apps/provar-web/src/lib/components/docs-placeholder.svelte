<script lang="ts">
	/**
	 * DocsPlaceholder is the universal "screenshot not yet captured" marker. It renders the
	 * canonical placeholder image from /docs/img/screenshot.png (which is itself a copy of
	 * docs/imgs/screenshot.png — see docs/PRODUCT.md § 9) with a clear "replace me" note.
	 *
	 * Usage:
	 *   <DocsPlaceholder caption="Editor canvas with a 4-step login test" />
	 *
	 * When the real screenshot is captured, replace this component with a plain `<figure><img .../>`
	 * pointing at the real asset.
	 */
	interface Props {
		caption: string;
		alt?: string;
	}
	let { caption, alt }: Props = $props();
</script>

<figure>
	<span class="placeholder-note">Placeholder — replace before publishing</span>
	<img
		src="/docs/img/screenshot.png"
		alt={alt ?? caption}
		loading="lazy"
		decoding="async"
		width="1822"
		height="1185"
	/>
	<figcaption>{caption}</figcaption>
</figure>
