/**
 * build-info centralizes deployment-specific URLs and flags so a staging deploy can be
 * configured separately from production. Mirrors the T023 audit fix: every hard-coded
 * deployment URL on the site should read from here.
 *
 * Configure via `.env` / Vite env (`PUBLIC_*` is exposed to the client):
 *   PUBLIC_INSTALL_LIVE    "true" to enable the curl install card; otherwise show "coming soon"
 *   PUBLIC_GITHUB_REPO     GitHub repo URL (default: https://github.com/thani-sh/provar)
 *   PUBLIC_INSTALL_BASE    Base URL for the one-line installer (default: https://provar.se)
 *   PUBLIC_DOWNLOAD_BASE   Base URL for desktop download artifacts
 */

const env = (import.meta as { env: Record<string, string | undefined> }).env;

export const buildInfo = {
	installLive: env.PUBLIC_INSTALL_LIVE === "true",
	githubRepo: env.PUBLIC_GITHUB_REPO ?? "https://github.com/thani-sh/provar",
	installBase: env.PUBLIC_INSTALL_BASE ?? "https://provar.se",
	downloadBase: env.PUBLIC_DOWNLOAD_BASE ?? ""
};
