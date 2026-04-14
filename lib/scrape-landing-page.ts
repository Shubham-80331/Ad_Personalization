import { chromium, type Browser } from "playwright";

export type ScrapeErrorCode =
  | "INVALID_URL"
  | "TIMEOUT"
  | "NAVIGATION"
  | "BLOCKED"
  | "UNKNOWN";

export type ScrapeSuccess = {
  ok: true;
  html: string;
  screenshotPngBase64: string;
  finalUrl: string;
  paletteHints: string[];
  fontStackHint?: string;
};

export type ScrapeFailure = {
  ok: false;
  code: ScrapeErrorCode;
  message: string;
};

export type ScrapeResult = ScrapeSuccess | ScrapeFailure;

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function extractVisualHints(page: import("playwright").Page): Promise<{
  paletteHints: string[];
  fontStackHint?: string;
}> {
  try {
    const hints = await page.evaluate(() => {
      const body = document.body;
      const cs = window.getComputedStyle(body);
      const font = cs.fontFamily || undefined;
      const samples: string[] = [];
      const els = [
        body,
        document.querySelector("h1"),
        document.querySelector("a,button"),
      ].filter(Boolean) as Element[];
      for (const el of els) {
        const s = window.getComputedStyle(el);
        samples.push(s.color, s.backgroundColor);
        const bc = s.borderColor;
        if (bc && bc !== "rgba(0, 0, 0, 0)") samples.push(bc);
      }
      const unique = [...new Set(samples)].slice(0, 12);
      return { paletteHints: unique, fontStackHint: font };
    });
    return hints;
  } catch {
    return { paletteHints: [] };
  }
}

let browserSingleton: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserSingleton || !browserSingleton.isConnected()) {
    browserSingleton = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserSingleton;
}

export async function closeScrapeBrowser(): Promise<void> {
  if (browserSingleton) {
    await browserSingleton.close().catch(() => {});
    browserSingleton = null;
  }
}

export async function scrapeLandingPage(
  url: string,
  options?: { timeoutMs?: number; reuseBrowser?: boolean },
): Promise<ScrapeResult> {
  if (!isHttpUrl(url)) {
    return { ok: false, code: "INVALID_URL", message: "URL must be http(s)" };
  }

  const timeoutMs = options?.timeoutMs ?? 45_000;
  const reuse = options?.reuseBrowser ?? true;

  let browser: Browser | null = null;
  let createdLocal = false;
  try {
    if (reuse) {
      browser = await getBrowser();
    } else {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      createdLocal = true;
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (!response) {
      await context.close();
      return {
        ok: false,
        code: "NAVIGATION",
        message: "No response from navigation",
      };
    }

    const status = response.status();
    if (status >= 400) {
      await context.close();
      return {
        ok: false,
        code: "BLOCKED",
        message: `HTTP ${status}`,
      };
    }

    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    const { paletteHints, fontStackHint } = await extractVisualHints(page);
    const html = await page.content();
    const png = await page.screenshot({ fullPage: true, type: "png" });
    const finalUrl = page.url();

    await context.close();
    if (createdLocal && browser) await browser.close();

    return {
      ok: true,
      html,
      screenshotPngBase64: Buffer.from(png).toString("base64"),
      finalUrl,
      paletteHints,
      fontStackHint,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const code: ScrapeErrorCode = /Timeout|timeout/i.test(msg)
      ? "TIMEOUT"
      : /net::|Navigation/i.test(msg)
        ? "NAVIGATION"
        : "UNKNOWN";
    if (createdLocal && browser) await browser.close().catch(() => {});
    return { ok: false, code, message: msg };
  }
}
