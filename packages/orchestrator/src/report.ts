import { nanoid } from "nanoid";
import type { FlaggedIssue, RuntimeError, VisualIssue, Severity } from "./types.js";

/** Turns raw runtime errors + visual issues into de-duplicated, severity-ranked, actionable issues. */
export function buildFlaggedIssues(errors: RuntimeError[], visualIssues: VisualIssue[]): FlaggedIssue[] {
  const issues: FlaggedIssue[] = [];

  for (const err of dedupeErrors(errors)) {
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
