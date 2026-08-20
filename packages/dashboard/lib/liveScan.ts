import dns from "node:dns/promises";
import { nanoid } from "nanoid";
import type { Browser, Page } from "playwright-core";
import type {
  FlaggedIssue,
  LogLine,
  ScanReport,
  Severity,
  ViewportResult,
  VisualIssue,
} from "./types";

interface RuntimeError {
  type: "console" | "network" | "unhandled";
  message: string;
  route: string;
  timestamp: string;
  status?: number;
  url?: string;
}

const VIEWPORTS: { name: ViewportResult["name"]; width: number; height: number }[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

const EDGE_PAYLOADS = ["", "🔥💀🚀", "<script>alert(1)</script>", "a".repeat(500)];

const MAX_ROUTES = 2;
const NAV_TIMEOUT_MS = 10_000;

export class ScanError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

class RunLogger {
  lines: LogLine[] = [];
  private push(level: LogLine["level"], message: string) {
    this.lines.push({ timestamp: new Date().toISOString(), level, message });
  }
  info(m: string) {
    this.push("info", m);
  }
  warn(m: string) {
    this.push("warn", `⚠ ${m}`);
  }
  success(m: string) {
    this.push("success", `✓ ${m}`);
  }
}

/** Validates the target is a public http(s) URL and blocks SSRF into private/internal networks. */
async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ScanError("Enter a valid URL, e.g. https://example.com");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScanError("Only http:// and https:// URLs are supported");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname === "0.0.0.0") {
    throw new ScanError("Can't scan localhost/internal addresses");
  }

  let addresses: string[];
  try {
    addresses = (await dns.lookup(hostname, { all: true })).map((a) => a.address);
  } catch {
    throw new ScanError(`Could not resolve host: ${hostname}`);
  }
  for (const addr of addresses) {
    if (isPrivateAddress(addr)) {
      throw new ScanError("That host resolves to a private/internal address and can't be scanned");
    }
  }
  return url;
}

function isPrivateAddress(addr: string): boolean {
  if (addr.includes(":")) {
    const a = addr.toLowerCase();
    return a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80");
  }
  const parts = addr.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

async function launchBrowser(): Promise<Browser> {
  // Serverless (Vercel/Lambda, Linux): use the prebuilt sparticuz binary.
  try {
    const { default: chromium } = await import("@sparticuz/chromium");
    const { chromium: playwrightChromium } = await import("playwright-core");
    const executablePath = await chromium.executablePath();
    return await playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  } catch {
    // Local dev (Windows/macOS) fallback: full "playwright" package with its own browser.
    const { chromium: fullChromium } = await import("playwright");
    return (await fullChromium.launch({ headless: true })) as unknown as Browser;
  }
}

export async function runLiveScan(targetUrlRaw: string): Promise<ScanReport> {
  const log = new RunLogger();
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const targetUrl = await assertPublicHttpUrl(targetUrlRaw);
  const origin = targetUrl.origin;
  log.info(`Provisioning headless browser for ${origin}`);

  let browser: Browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    throw new ScanError(`Could not start the scanning browser: ${(err as Error).message}`, 500);
  }

  const errors: RuntimeError[] = [];
  const routesTested: string[] = [];
  const viewportResults: ViewportResult[] = [];
  const visualIssues: VisualIssue[] = [];
  let framework = "Unknown";

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachErrorListeners(page, origin, errors);

    const primaryRoute = targetUrl.pathname || "/";
    log.info(`Ghost Agent → navigating ${primaryRoute}`);
    await safeGoto(page, targetUrl.toString(), log, primaryRoute);
    routesTested.push(primaryRoute);
    framework = await detectFramework(page);
    await chaosSweepInputs(page, primaryRoute, log);
    await clickFirstInteractiveElement(page);

    const extraRoutes = await discoverSameOriginLinks(page, origin, MAX_ROUTES - 1);
    for (const route of extraRoutes) {
      log.info(`Ghost Agent → navigating ${route}`);
      await safeGoto(page, new URL(route, origin).toString(), log, route);
      routesTested.push(route);
      await chaosSweepInputs(page, route, log);
    }
    log.success(`Chaos sweep complete — ${dedupeErrors(errors).length} runtime error(s) captured`);

    // Reuse the same loaded page for every viewport — only the CSS viewport
    // changes, so this avoids a full reload (and another networkidle wait)
    // per breakpoint.
    log.info("Capturing viewport screenshots...");
    await page.goto(targetUrl.toString(), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(250);

      const screenshotBuffer = await page.screenshot({ type: "jpeg", quality: 45 });
      const screenshotDataUrl = `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`;
      viewportResults.push({
        name: vp.name,
        width: vp.width,
        height: vp.height,
        route: primaryRoute,
        screenshotPath: "",
        screenshotDataUrl,
      });

      visualIssues.push(...(await runHeuristicChecks(page, vp.name, primaryRoute)));
    }
    log.success(`Visual audit complete — ${visualIssues.length} visual issue(s) flagged`);
    await context.close();
  } finally {
    await browser.close();
  }

  const issues = buildFlaggedIssues(dedupeErrors(errors), visualIssues);
  const finishedAt = new Date().toISOString();
  log.success(`Scan complete — ${issues.length} issue${issues.length === 1 ? "" : "s"} flagged`);

  return {
    meta: {
      repo: targetUrl.toString(),
      branch: "live",
      framework,
      startedAt,
      finishedAt,
      durationMs: Date.now() - start,
    },
    log: log.lines,
    errors,
    viewports: viewportResults,
    visualIssues,
    issues,
    routesTested,
  };
}

function attachErrorListeners(page: Page, origin: string, errors: RuntimeError[]) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && page.url().startsWith(origin)) {
      errors.push({
        type: "console",
        message: msg.text(),
        route: routeOf(page.url()),
        timestamp: new Date().toISOString(),
      });
    }
  });
  page.on("pageerror", (err) => {
    if (!page.url().startsWith(origin)) return;
    errors.push({
      type: "unhandled",
      message: err.message,
      route: routeOf(page.url()),
      timestamp: new Date().toISOString(),
    });
  });
  page.on("response", (res) => {
    if (res.status() >= 500 && res.url().startsWith(origin)) {
      errors.push({
        type: "network",
        message: `${res.status()} ${res.statusText()}`,
        route: routeOf(res.url()),
        url: res.url(),
        status: res.status(),
        timestamp: new Date().toISOString(),
      });
    }
  });
}

function routeOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

async function safeGoto(page: Page, url: string, log: RunLogger, route: string) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
  } catch {
    log.warn(`Timed out waiting for ${route} to settle — continuing`);
  }
}

async function detectFramework(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      if (w.__NEXT_DATA__) return "Next.js";
      if (document.querySelector("#__nuxt")) return "Nuxt";
      if (document.querySelector("[data-reactroot], #root")) return "React";
      if (document.querySelector("#app")?.hasAttribute("data-v-app")) return "Vue";
      const generator = document.querySelector('meta[name="generator"]')?.getAttribute("content");
      return generator || "Unknown";
    });
  } catch {
    return "Unknown";
  }
}

async function discoverSameOriginLinks(page: Page, origin: string, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  try {
    const links: string[] = await page.evaluate((o) => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => href.startsWith(o));
    }, origin);
    const routes = new Set<string>();
    for (const href of links) {
      const path = new URL(href).pathname;
      if (path && path !== "/" && !path.startsWith("/api/")) routes.add(path);
      if (routes.size >= limit) break;
    }
    return Array.from(routes);
  } catch {
    return [];
  }
}

async function chaosSweepInputs(page: Page, route: string, log: RunLogger) {
  const inputs = await page.locator("input:not([type=hidden]), textarea").all();
  if (inputs.length === 0) return;

  for (const payload of EDGE_PAYLOADS) {
    for (const input of inputs.slice(0, 4)) {
      try {
        await input.fill(payload, { timeout: 1000 });
      } catch {
        // not fillable — skip
      }
    }
    const form = page.locator("form").first();
    if (await form.count()) {
      try {
        await form.evaluate((f: HTMLFormElement) => f.requestSubmit?.());
        await page.waitForTimeout(150);
      } catch {
        /* ignore */
      }
    }
  }
  log.info(`Ghost Agent → injecting edge payloads on ${route} (${EDGE_PAYLOADS.length} variants × ${Math.min(inputs.length, 4)} fields)`);
}

async function clickFirstInteractiveElement(page: Page) {
  const buttons = await page.locator("button:visible, a[role=button]:visible").all();
  for (const btn of buttons.slice(0, 3)) {
    try {
      await btn.click({ timeout: 1000 });
      await page.waitForTimeout(200);
    } catch {
      /* ignore unclickable elements */
    }
  }
}

async function runHeuristicChecks(page: Page, viewport: ViewportResult["name"], route: string): Promise<VisualIssue[]> {
  const issues: VisualIssue[] = [];

  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 4;
  });
  if (hasOverflow) {
    issues.push({
      viewport,
      route,
      description: "Horizontal overflow detected — content extends beyond the viewport width",
      screenshotPath: "",
      severity: viewport === "mobile" ? "high" : "medium",
    });
  }

  const overlapCount = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("body *")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 10 && getComputedStyle(el).display !== "none";
    }) as HTMLElement[];
    let collisions = 0;
    for (let i = 0; i < Math.min(els.length, 200); i++) {
      for (let j = i + 1; j < Math.min(els.length, 200); j++) {
        const a = els[i].getBoundingClientRect();
        const b = els[j].getBoundingClientRect();
        const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
        if (overlap && !els[i].contains(els[j]) && !els[j].contains(els[i])) {
          const overlapArea =
            Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const smaller = Math.min(a.width * a.height, b.width * b.height);
          if (smaller > 0 && overlapArea / smaller > 0.4) collisions++;
        }
      }
    }
    return collisions;
  });
  if (overlapCount > 0) {
    issues.push({
      viewport,
      route,
      description: `Overlapping text/elements detected (${overlapCount} colliding pair${overlapCount > 1 ? "s" : ""})`,
      screenshotPath: "",
      severity: "medium",
    });
  }

  return issues;
}

function dedupeErrors(errors: RuntimeError[]): RuntimeError[] {
  const seen = new Set<string>();
  const out: RuntimeError[] = [];
  for (const e of errors) {
    const key = `${e.type}:${e.route}:${e.message.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function buildFlaggedIssues(errors: RuntimeError[], visualIssues: VisualIssue[]): FlaggedIssue[] {
  const issues: FlaggedIssue[] = [];

  for (const err of errors) {
    issues.push({
      id: nanoid(6),
      severity: severityForError(err),
      title: titleForError(err),
      description: err.message,
      route: err.route,
      kind: "runtime",
      suggestedFix: suggestFixForError(err),
    });
  }

  for (const vi of visualIssues) {
    issues.push({
      id: nanoid(6),
      severity: vi.severity,
      title: `${capitalize(vi.viewport)} layout issue on ${vi.route}`,
      description: vi.description,
      route: vi.route,
      kind: "visual",
      suggestedFix: suggestFixForVisual(vi),
    });
  }

  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

function severityForError(err: RuntimeError): Severity {
  if (err.type === "network" && (err.status ?? 0) >= 500) return "critical";
  if (err.type === "unhandled") return "high";
  return "medium";
}

function titleForError(err: RuntimeError): string {
  if (err.type === "network") return `${err.status} error on ${err.route}`;
  if (err.type === "unhandled") return `Unhandled exception on ${err.route}`;
  return `Console error on ${err.route}`;
}

function suggestFixForError(err: RuntimeError): string {
  if (err.type === "network" && (err.status ?? 0) >= 500) {
    return "Add input validation and a try/catch around the handler for this route — the server is throwing on unexpected input rather than returning a 4xx.";
  }
  if (/cannot read propert(y|ies) of undefined/i.test(err.message)) {
    return "Guard the access with optional chaining (?.) or a null check before the property is read — the underlying value isn't guaranteed to exist yet.";
  }
  if (err.type === "unhandled") {
    return "Wrap this code path in a try/catch or an error boundary so a single bad input can't crash the whole view.";
  }
  return "Review the console output around this route for the root cause and add a guard clause or fallback UI.";
}

function suggestFixForVisual(vi: VisualIssue): string {
  if (/overflow/i.test(vi.description)) {
    return "Add `overflow-x: hidden` or constrain the offending element with `max-width: 100%` / a responsive flex-wrap.";
  }
  if (/overlap/i.test(vi.description)) {
    return "Increase spacing/margin between the colliding elements at this breakpoint, or switch to a stacked (flex-column) layout below the tablet breakpoint.";
  }
  return "Inspect this viewport in devtools at the same width and adjust the responsive breakpoint styles.";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
