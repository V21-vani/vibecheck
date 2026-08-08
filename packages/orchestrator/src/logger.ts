import pc from "picocolors";
import type { LogLine } from "./types.js";

export class Logger {
  lines: LogLine[] = [];

  private push(level: LogLine["level"], message: string) {
    const line: LogLine = { timestamp: new Date().toISOString(), level, message };
    this.lines.push(line);
    const stamp = pc.dim(new Date(line.timestamp).toLocaleTimeString());
    const painters: Record<LogLine["level"], (s: string) => string> = {
      info: pc.gray,
      warn: pc.yellow,
      error: pc.red,
      success: pc.green,
    };
    // eslint-disable-next-line no-console
    console.log(`${stamp}  ${painters[level](message)}`);
  }

  info(message: string) {
    this.push("info", message);
  }
  warn(message: string) {
    this.push("warn", `⚠ ${message}`);
  }
  error(message: string) {
    this.push("error", `✗ ${message}`);
  }
  success(message: string) {
    this.push("success", `✓ ${message}`);
  }
}
