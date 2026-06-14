import { Utils } from "electrobun/bun";

/**
 * openExternal asks the OS to open the given URL in the user's default handler. Returns the
 * boolean result from Electrobun's bridge (`true` if the OS accepted the request — the actual
 * browser launch may still fail, but the shell call itself didn't error).
 *
 * URL validation is intentionally minimal: we let the OS handler decide what it will and won't
 * open. The only hard guard is the scheme allowlist, to prevent `file://` or other dangerous
 * schemes from being passed through.
 */
export const openExternal = (params: { url: string }) => {
  const { url } = params;

  if (!url || typeof url !== "string") {
    return { success: false };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { success: false };
  }

  const allowed = new Set(["http:", "https:", "mailto:"]);
  if (!allowed.has(parsed.protocol)) {
    return { success: false };
  }

  return { success: Utils.openExternal(url) };
};
