export type Severity = "critical" | "high" | "medium" | "low";

export interface FlaggedIssue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  route: string;
  kind: "runtime" | "visual";
  suggestedFix?: string;
}

export interface LogLine {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface ViewportResult {
  name: "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
  route: string;
  screenshotPath: string;
  /** Present for live scans — a data: URL the dashboard can render directly. */
  screenshotDataUrl?: string;
}

export interface VisualIssue {
  viewport: ViewportResult["name"];
  route: string;
  description: string;
  screenshotPath: string;
  severity: Severity;
}

export interface ScanReport {
  meta: {
    repo: string;
    branch: string;
    framework: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
  };
  log: LogLine[];
  errors: unknown[];
  viewports: ViewportResult[];
  visualIssues: VisualIssue[];
  issues: FlaggedIssue[];
  routesTested: string[];
}
