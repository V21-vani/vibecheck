import type { FlaggedIssue } from "@/lib/types";

const severityStyle: Record<FlaggedIssue["severity"], string> = {
  critical: "bg-berry/10 text-berry",
  high: "bg-amber-500/10 text-amber-700",
  medium: "bg-olive/20 text-[#5c6339]",
  low: "bg-ink-muted/10 text-ink-muted",
};

export function IssueRow({ issue }: { issue: FlaggedIssue }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 flex items-start gap-4">
      <span
        className={`shrink-0 text-[10px] font-bold tracking-wide px-3 py-1.5 rounded-lg ${severityStyle[issue.severity]}`}
      >
        {issue.severity.toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-ink">{issue.title}</div>
        <div className="text-xs text-ink-muted mt-1">{issue.description}</div>
        {issue.suggestedFix && (
          <div className="text-xs text-[#5c6339] mt-2 bg-olive/10 rounded-lg px-3 py-2">
            💡 {issue.suggestedFix}
          </div>
        )}
      </div>
      <button className="shrink-0 text-xs font-semibold text-ink-muted border border-ink/15 rounded-lg px-4 py-2 hover:bg-cream2 transition-colors">
        View Fix
      </button>
    </div>
  );
}
