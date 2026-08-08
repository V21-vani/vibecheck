import path from "node:path";
import fs from "node:fs/promises";
import { Logger } from "./logger.js";
import { provisionSandbox, discoverRoutes } from "./sandbox.js";
import { runGhostAgent } from "./ghostAgent.js";
import { runVisualAudit } from "./visualAudit.js";
import { buildFlaggedIssues } from "./report.js";
import { generatePatch } from "./patchGen.js";
import type { ScanReport } from "./types.js";

export interface ScanOptions {
  repoUrl: string;
  branch?: string;
  outDir?: string;
}

export async function scan(options: ScanOptions): Promise<{ report: ScanReport; outDir: string }> {
  const log = new Logger();
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const outDir = options.outDir ?? path.join(process.cwd(), ".vibecheck", Date.now().toString());
  await fs.mkdir(outDir, { recursive: true });

  const sandbox = await provisionSandbox(options.repoUrl, options.branch, log);

  try {
    const routes = await discoverRoutes(sandbox.dir);
    log.info(`Discovered ${routes.length} route(s) to test: ${routes.join(", ")}`);

    log.info("Ghost Agent starting chaos sweep...");
    const errors = await runGhostAgent(sandbox.baseUrl, routes, log);
    log.success(`Chaos sweep complete — ${errors.length} runtime error(s) captured`);

    log.info("Capturing viewport screenshots...");
    const { viewports, issues: visualIssues } = await runVisualAudit(sandbox.baseUrl, routes, path.join(outDir, "screenshots"), log);
    log.success(`Visual audit complete — ${visualIssues.length} visual issue(s) flagged`);

    const issues = buildFlaggedIssues(errors, visualIssues);
    await generatePatch(issues, outDir, log);

    const finishedAt = new Date().toISOString();
    log.success(`Scan complete — ${issues.length} issue${issues.length === 1 ? "" : "s"} flagged`);

    const report: ScanReport = {
      meta: {
        repo: options.repoUrl,
        branch: options.branch ?? "default",
        framework: sandbox.framework,
        startedAt,
        finishedAt,
        durationMs: Date.now() - start,
      },
      log: log.lines,
      errors,
      viewports,
      visualIssues,
      issues,
      routesTested: routes,
    };

    await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");
    return { report, outDir };
  } finally {
    await sandbox.cleanup();
  }
}
