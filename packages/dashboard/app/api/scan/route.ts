import { NextRequest, NextResponse } from "next/server";
import { runLiveScan, ScanError } from "@/lib/liveScan";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = (body as { url?: unknown })?.url;
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Missing 'url' field" }, { status: 400 });
  }

  try {
    const report = await runLiveScan(url.trim());
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof ScanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Live scan failed:", err);
    return NextResponse.json({ error: "Scan failed unexpectedly — the target site may be blocking automated browsers." }, { status: 500 });
  }
}
