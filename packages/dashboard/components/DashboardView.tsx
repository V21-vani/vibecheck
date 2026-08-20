"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { LogPanel } from "@/components/LogPanel";
import { ViewportCard } from "@/components/ViewportCard";
import { IssueRow } from "@/components/IssueRow";
import type { ScanReport } from "@/lib/types";

const STORAGE_KEY = "vibecheck:lastReport";

export function DashboardView({ sampleReport }: { sampleReport: ScanReport }) {
  const [mounted, setMounted] = useState(false);
  const [report, setReport] = useState<ScanReport>(sampleReport);
  const [isSample, setIsSample] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReport(JSON.parse(stored) as ScanReport);
        setIsSample(false);
      }
    } catch {
      // corrupt/unavailable storage — stick with the sample report
    }
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-cream" />;
  }

  const { meta, issues, log, viewports } = report;
  const critical = issues.filter((i) => i.severity === "critical").length;
  const visualCount = issues.filter((i) => i.kind === "visual").length;
  const runtimeCount = issues.filter((i) => i.kind === "runtime").length;

  return (
    <main className="min-h-screen bg-cream">
      <div className="border-b border-ink/5 bg-white">
        <Navbar variant="app" />
      </div>

      <div className="flex">
        <Sidebar meta={meta} />

        <div className="flex-1 px-8 py-6 max-w-[1200px]">
          {isSample ? (
            <div className="bg-amber-500/10 text-amber-800 rounded-2xl px-5 py-3 flex items-center justify-between mb-6 text-sm font-medium">
              <span>Showing sample data — run a real scan from the homepage to see your own results.</span>
              <Link href="/" className="font-semibold underline shrink-0 ml-4">
                Scan a site →
              </Link>
            </div>
          ) : (
            <div className="bg-olive/15 rounded-2xl px-5 py-3 flex items-center justify-between mb-6 text-sm">
              <span className="font-semibold text-ink">Live scan of {meta.repo}</span>
              <Link href="/" className="font-semibold text-[#5c6339] underline shrink-0 ml-4">
                Scan another site →
              </Link>
            </div>
          )}

          {/* status banner */}
          <div className="bg-olive/15 rounded-2xl px-5 py-4 flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5c6339]" />
              <div>
                <div className="font-semibold text-sm text-ink">Scan Complete — {issues.length} issues found</div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {(meta.durationMs / 1000).toFixed(0)}s total runtime · {report.routesTested.length} routes tested
                  {critical > 0 ? ` · ${critical} critical` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* stat cards */}
          <div className="flex gap-4 mb-8 flex-wrap">
            <StatCard label="ERRORS CAUGHT" value={String(runtimeCount)} accentClass="bg-berry" />
            <StatCard label="VISUAL ISSUES" value={String(visualCount)} accentClass="bg-amber-500" />
            <StatCard label="VIEWPORTS TESTED" value={String(viewports.length)} accentClass="bg-olive" />
            <StatCard label="SCAN TIME" value={`${(meta.durationMs / 1000).toFixed(0)}s`} accentClass="bg-[#8b7cd8]" />
          </div>

          {/* log + visual inspection */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 mb-8">
            <div>
              <h2 className="font-bold text-ink mb-3">Live Execution Log</h2>
              <LogPanel lines={log} />
            </div>
            <div>
              <h2 className="font-bold text-ink mb-3">
                Visual Inspection — {report.routesTested[1] ?? report.routesTested[0]}
              </h2>
              <div className="space-y-3">
                {viewports.map((vp) => {
                  const flag = report.visualIssues.find((vi) => vi.viewport === vp.name && vi.route === vp.route);
                  return (
                    <ViewportCard
                      key={vp.name}
                      label={`${vp.name.toUpperCase()} · ${vp.width}px`}
                      flagLabel={flag?.description}
                      screenshotDataUrl={vp.screenshotDataUrl}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* flagged issues */}
          <h2 className="font-bold text-ink mb-3">Flagged Issues</h2>
          <div className="space-y-3 mb-24">
            {issues.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-soft p-6 text-sm text-ink-muted text-center">
                No issues found — the Ghost Agent came back clean. 🎉
              </div>
            ) : (
              issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
            )}
          </div>
        </div>
      </div>

      {/* sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-ink/5 h-16 flex items-center justify-between px-8">
        <span className="font-semibold text-sm text-ink">{issues.length} issues ready to patch</span>
        <div className="flex gap-3">
          <button className="border border-ink/15 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-cream2 transition-colors">
            Open Pull Request
          </button>
          <button className="bg-berry text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
            ⚡ Generate Patch
          </button>
        </div>
      </div>
    </main>
  );
}
