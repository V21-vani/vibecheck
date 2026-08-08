import { chromium, type Browser } from "playwright";
import { EDGE_PAYLOADS, type RuntimeError } from "./types.js";
import type { Logger } from "./logger.js";

/**
 * The Ghost Agent drives a headless browser through the app's routes,
 * capturing console errors and failed network requests, then goes back
 * over form inputs on each page injecting chaotic edge-case payloads
 * (empty strings, emoji, script tags, huge strings) to surface unhandled
 * exceptions that a happy-path click-through would never hit.
 */
export async function runGhostAgent(baseUrl: string, routes: string[], log: Logger): Promise<RuntimeError[]> {
  const browser: Browser = await chromium.launch({ headless: true });
  const errors: RuntimeError[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push({
          type: "console",
          message: msg.text(),
          route: page.url().replace(baseUrl, "") || "/",
          timestamp: new Date().toISOString(),
        });
      }
    });

    page.on("pageerror", (err) => {
      errors.push({
        type: "unhandled",
        message: err.message,
        route: page.url().replace(baseUrl, "") || "/",
        timestamp: new Date().toISOString(),
        stack: err.stack,
      });
    });

    page.on("response", (res) => {
      if (res.status() >= 500) {
        errors.push({
          type: "network",
          message: `${res.status()} ${res.statusText()}`,
          route: page.url().replace(baseUrl, "") || "/",
          url: res.url(),
          status: res.status(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    for (const route of routes) {
      const url = new URL(route, baseUrl).toString();
      log.info(`Ghost Agent → navigating ${route}`);
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
      } catch {
        log.warn(`Timed out waiting for ${route} to settle — continuing`);
      }

      await chaosSweepInputs(page, route, log);
      await clickFirstInteractiveElement(page, route, log);
    }
  } finally {
    await browser.close();
  }

  return errors;
}

async function chaosSweepInputs(page: import("playwright").Page, route: string, log: Logger) {
  const inputs = await page.locator("input:not([type=hidden]), textarea").all();
  if (inputs.length === 0) return;

  for (const payload of EDGE_PAYLOADS) {
    for (const input of inputs.slice(0, 4)) {
      try {
        await input.fill(payload, { timeout: 1000 });
      } catch {
        // input not fillable (disabled, readonly, etc.) — skip
      }
    }
    // try submitting the nearest form, if any, to trigger validation/handlers
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

async function clickFirstInteractiveElement(page: import("playwright").Page, route: string, log: Logger) {
  const buttons = await page.locator("button:visible, a[role=button]:visible").all();
  for (const btn of buttons.slice(0, 3)) {
    try {
      await btn.click({ timeout: 1000, trial: false });
      await page.waitForTimeout(200);
    } catch {
      /* ignore unclickable elements */
    }
  }
}
