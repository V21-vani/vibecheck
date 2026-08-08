#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import path from "node:path";
import { scan } from "./scan.js";

const program = new Command();

program
  .name("vibecheck")
  .description("Autonomous Sandboxed QA & Visual UI/UX Auditor for vibe-coded repos")
  .version("0.1.0");

program
  .command("scan")
  .description("Clone, sandbox-run, and audit a repo")
  .argument("<repo-url>", "GitHub repository URL to scan")
  .option("-b, --branch <branch>", "branch to check out")
  .option("-o, --out <dir>", "output directory for the report + screenshots")
  .action(async (repoUrl: string, opts: { branch?: string; out?: string }) => {
    console.log(pc.bold(pc.magenta("\n  VibeCheck ") + pc.cyan("— Autonomous Sandboxed QA\n")));
    try {
      const { report, outDir } = await scan({ repoUrl, branch: opts.branch, outDir: opts.out });
      console.log("\n" + pc.bold("Summary"));
      console.log(`  Framework:     ${report.meta.framework}`);
      console.log(`  Duration:      ${(report.meta.durationMs / 1000).toFixed(1)}s`);
      console.log(`  Routes tested: ${report.routesTested.length}`);
      console.log(`  Issues found:  ${report.issues.length}`);
      console.log(`\n  Report:  ${path.join(outDir, "report.json")}`);
      console.log(`  Patch notes:  ${path.join(outDir, "PATCH_NOTES.md")}`);
      console.log(`\n  View it in the dashboard:  npm run dashboard  (then open the report from ${outDir})\n`);
      process.exit(report.issues.some((i) => i.severity === "critical") ? 1 : 0);
    } catch (err) {
      console.error(pc.red(`\nScan failed: ${(err as Error).message}`));
      process.exit(2);
    }
  });

program.parseAsync();
