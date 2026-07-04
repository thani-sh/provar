/**
 * build-info centralizes deployment-specific URLs so a staging deploy can be configured
 * separately from production.
 *
 * Configure via `.env` / Vite env (`PUBLIC_*` is exposed to the client):
 *   PUBLIC_URL         Public-facing project URL — install script lives at
 *                       ${PUBLIC_URL}/install.sh, desktop artifacts under
 *                       ${PUBLIC_URL}/downloads/.
 *   PUBLIC_GITHUB_REPO GitHub repo URL (default: https://github.com/thani-sh/provar)
 */

const env = (import.meta as { env: Record<string, string | undefined> }).env;

export const buildInfo = {
  url: env.PUBLIC_URL ?? "https://provar.se",
  githubRepo: env.PUBLIC_GITHUB_REPO ?? "https://github.com/thani-sh/provar",
};
