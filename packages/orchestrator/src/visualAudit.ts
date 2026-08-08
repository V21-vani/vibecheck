import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { VIEWPORTS, type VisualIssue, type ViewportResult } from "./types.js";
import type { Logger } from "./logger.js";

export async function runVisualAudit(
  baseUrl: string,
  routes: string[],
  outDir: string,
  log: Logger
): Promise<{ viewports: ViewportResult[]; issues: VisualIssue[] }> {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const viewportResults: ViewportResult[] = [];
  const issues: VisualIssue[] = [];

  try {
    const route = routes[0] ?? "/";
    const url = new URL(route, baseUrl).toString();

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      log.info(`Capturing ${vp.name} viewport (${vp.width}×${vp.height}) for ${route}`);
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
      } catch {
        log.warn(`${vp.name}: page did not settle within timeout`);
      }

      const screenshotPath = path.join(outDir, `${vp.name}-${sanitize(route)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      viewportResults.push({ name: vp.name, width: vp.width, height: vp.height, route, screenshotPath });

      // Cheap heuristic layout checks — catches the common failure modes
      // without needing a model call for every single screenshot.
      const heuristicIssues = await runHeuristicChecks(page, vp.name, route, screenshotPath);
      issues.push(...heuristicIssues);

      await context.close();
    }

    // Optional: hand the mobile screenshot to Claude Vision for a second
    // opinion when an API key is configured. Skipped entirely in offline/demo mode.
    if (process.env.ANTHROPIC_API_KEY) {
      const mobileShot = viewportResults.find((v) => v.name === "mobile");
      if (mobileShot) {
        const aiIssue = await analyzeWithClaude(mobileShot, log);
        if (aiIssue) issues.push(aiIssue);
      }
    }
  } finally {
    await browser.close();
  }

  return { viewports: viewportResults, issues };
}

async function runHeuristicChecks(
  page: import("playwright").Page,
  viewport: VisualIssue["viewport"],
  route: string,
  screenshotPath: string
): Promise<VisualIssue[]> {
  const issues: VisualIssue[] = [];

  // 1. Horizontal overflow — the classic "broken on mobile" signature.
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 4;
  });
  if (hasOverflow) {
    issues.push({
      viewport,
      route,
      description: "Horizontal overflow detected — content extends beyond the viewport width",
      screenshotPath,
      severity: viewport === "mobile" ? "high" : "medium",
    });
  }

  // 2. Overlapping elements — bounding-box collision on visible block-level nodes.
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
      screenshotPath,
      severity: "medium",
    });
  }

  return issues;
}

async function analyzeWithClaude(shot: ViewportResult, log: Logger): Promise<VisualIssue | null> {
  try {
    log.info("VLM Layout Inspector → analyzing screenshot with Claude Vision");
    const client = new Anthropic();
    const imageBuffer = await fs.readFile(shot.screenshotPath);
    const base64 = imageBuffer.toString("base64");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
            {
              type: "text",
              text:
                "You are a QA visual auditor. Look at this mobile viewport screenshot. " +
                "In one short sentence, name the single most obvious layout problem if there is one " +
                "(overlap, cut-off text, broken alignment, unreadable contrast). " +
                'If nothing looks broken, reply exactly with "OK".',
            },
          ],
        },
      ],
    });

    const text = response.content.find((c) => c.type === "text")?.text?.trim() ?? "OK";
    if (text === "OK" || text.length < 3) return null;

    return {
      viewport: shot.name,
      route: shot.route,
      description: text,
      screenshotPath: shot.screenshotPath,
      severity: "medium",
    };
  } catch (err) {
    log.warn(`Claude Vision analysis skipped (${(err as Error).message})`);
    return null;
  }
}

function sanitize(route: string): string {
  return route.replace(/\//g, "_") || "root";
}
