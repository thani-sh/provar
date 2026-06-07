import { chromium, type Browser, type Page } from "playwright";

/**
 * BrowserSession holds the active browser instance, associated page, and clean up method.
 */
export interface BrowserSession {
  browser: Browser;
  page: Page;
  close: () => Promise<void>;
}

/**
 * launchBrowserSession launches a new Playwright chromium browser session.
 */
export async function launchBrowserSession(options?: {
  headless?: boolean;
}): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless: options?.headless !== false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  return {
    browser,
    page,
    close: async () => {
      await browser.close();
    },
  };
}
