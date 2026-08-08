export type Severity = "critical" | "high" | "medium" | "low";

export interface RuntimeError {
  type: "console" | "network" | "unhandled";
  message: string;
  route: string;
  timestamp: string;
  status?: number;
  url?: string;
  stack?: string;
}

export interface VisualIssue {
  viewport: "desktop" | "tablet" | "mobile";
  route: string;
  description: string;
  screenshotPath: string;
  severity: Severity;
}

export interface FlaggedIssue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  route: string;
  kind: "runtime" | "visual";
  suggestedFix?: string;
}

export interface ViewportResult {
  name: "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
  route: string;
  screenshotPath: string;
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
  errors: RuntimeError[];
  viewports: ViewportResult[];
  visualIssues: VisualIssue[];
  issues: FlaggedIssue[];
  routesTested: string[];
}

export interface LogLine {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export const VIEWPORTS: { name: ViewportResult["name"]; width: number; height: number }[] = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

export const EDGE_PAYLOADS = ["", " ", "🔥💀🚀", "<script>alert(1)</script>", "null", "0", "-1", "a".repeat(500)];
