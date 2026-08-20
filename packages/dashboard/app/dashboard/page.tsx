import fs from "node:fs/promises";
import path from "node:path";
import { DashboardView } from "@/components/DashboardView";
import type { ScanReport } from "@/lib/types";

async function loadSampleReport(): Promise<ScanReport> {
  const reportPath = process.env.VIBECHECK_REPORT_PATH ?? path.join(process.cwd(), "public", "sample-report.json");
  const raw = await fs.readFile(reportPath, "utf-8");
  return JSON.parse(raw) as ScanReport;
}

export default async function DashboardPage() {
  const sampleReport = await loadSampleReport();
  return <DashboardView sampleReport={sampleReport} />;
}
