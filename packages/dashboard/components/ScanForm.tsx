"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  "Provisioning headless browser...",
  "Ghost Agent sweeping routes & injecting edge cases...",
  "Capturing viewport screenshots...",
  "Ranking and drafting fixes...",
];

export function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setError(null);
    setLoading(true);
    setStageIdx(0);

    const stageTimer = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, 3500);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Scan failed");
      }
      sessionStorage.setItem("vibecheck:lastReport", JSON.stringify(data));
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    } finally {
      clearInterval(stageTimer);
    }
  }

  return (
    <div className="mt-10">
      <form onSubmit={handleSubmit} className="flex items-center justify-center gap-3 flex-wrap">
        <input
          type="url"
          required
          placeholder="https://your-deployed-app.vercel.app"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          className="w-full max-w-sm px-5 py-3.5 rounded-xl border border-ink/15 text-sm focus:outline-none focus:ring-2 focus:ring-berry/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-berry text-white font-semibold px-8 py-3.5 rounded-xl shadow-[0_8px_24px_rgba(204,58,99,0.35)] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Scanning..." : "Scan This Site →"}
        </button>
      </form>

      {loading && (
        <p className="text-xs font-medium text-ink-muted mt-4 tracking-wide animate-pulse">
          {STAGES[stageIdx]}
        </p>
      )}
      {error && <p className="text-xs font-semibold text-berry mt-4">{error}</p>}
      {!loading && !error && (
        <p className="text-xs font-medium text-ink-muted mt-4 tracking-wide">
          Paste the URL of a live, deployed site — VibeCheck runs a real Ghost Agent sweep against it.
        </p>
      )}
    </div>
  );
}
