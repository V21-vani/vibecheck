import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { FlaggedIssue } from "./types.js";
import type { Logger } from "./logger.js";

/**
 * Writes PATCH_NOTES.md — a ready-to-paste-into-your-AI-coding-assistant
 * summary of every flagged issue and its suggested fix. When an
 * ANTHROPIC_API_KEY is present, also asks Claude to draft an actual
 * unified diff for the single highest-severity issue.
 */
export async function generatePatch(issues: FlaggedIssue[], outDir: string, log: Logger): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  const notesPath = path.join(outDir, "PATCH_NOTES.md");

  const lines: string[] = [
    "# VibeCheck — Patch Notes",
    "",
    `Generated ${new Date().toISOString()} · ${issues.length} issue${issues.length === 1 ? "" : "s"} flagged`,
    "",
    "Paste this file into your AI coding assistant (Claude Code, Cursor, Copilot) to apply fixes directly.",
    "",
  ];

  for (const issue of issues) {
    lines.push(`## [${issue.severity.toUpperCase()}] ${issue.title}`);
    lines.push("");
    lines.push(`- **Route:** \`${issue.route}\``);
    lines.push(`- **Kind:** ${issue.kind}`);
    lines.push(`- **Detail:** ${issue.description}`);
    if (issue.suggestedFix) lines.push(`- **Suggested fix:** ${issue.suggestedFix}`);
    lines.push("");
  }

  await fs.writeFile(notesPath, lines.join("\n"), "utf-8");
  log.success(`Patch notes written to ${notesPath}`);

  if (process.env.ANTHROPIC_API_KEY && issues.length > 0) {
    await draftDiffForTopIssue(issues[0], outDir, log);
  }

  return notesPath;
}

async function draftDiffForTopIssue(issue: FlaggedIssue, outDir: string, log: Logger) {
  try {
    log.info(`Drafting a suggested diff for: ${issue.title}`);
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content:
            `A QA scan flagged this issue in a web app:\n\n` +
            `Title: ${issue.title}\nRoute: ${issue.route}\nDetail: ${issue.description}\n` +
            `Suggested direction: ${issue.suggestedFix}\n\n` +
            `Write a short, generic unified-diff-style code snippet (no real file paths needed, use a plausible ` +
            `placeholder filename) showing the kind of guard/fix that resolves this class of bug. Keep it under 20 lines.`,
        },
      ],
    });
    const text = response.content.find((c) => c.type === "text")?.text ?? "";
    if (text) {
      await fs.writeFile(path.join(outDir, "suggested-fix.diff.md"), text, "utf-8");
      log.success("AI-drafted diff written to suggested-fix.diff.md");
    }
  } catch (err) {
    log.warn(`Skipping AI diff draft (${(err as Error).message})`);
  }
}
