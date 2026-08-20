import { Navbar } from "@/components/Navbar";
import { ScanForm } from "@/components/ScanForm";

const features = [
  {
    icon: "⬡",
    title: "Zero-Config Scanning",
    desc: "Paste a live URL and VibeCheck launches a real headless browser against it — no setup, no config files, no waiting.",
  },
  {
    icon: "👻",
    title: "Ghost Agent Testing",
    desc: "An autonomous browser agent clicks through your app and injects edge-case payloads to surface silent bugs.",
  },
  {
    icon: "◈",
    title: "Visual AI Audit",
    desc: "Vision AI inspects every viewport for broken layouts, overlapping text, and contrast issues — automatically.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-cream">
      <Navbar variant="marketing" />

      <section className="max-w-4xl mx-auto text-center px-6 pt-16">
        <span className="inline-flex items-center gap-2 bg-olive/20 text-[#5c6339] text-xs font-semibold px-4 py-2 rounded-full border border-olive/40">
          ✦ AI-Powered QA for Vibe-Coded Repos
        </span>

        <h1 className="text-4xl md:text-6xl font-bold text-ink mt-8 leading-tight">
          Ship AI-generated code
          <br />
          with total confidence.
        </h1>

        <p className="text-lg text-ink-muted mt-6 max-w-2xl mx-auto leading-relaxed">
          VibeCheck sends a Ghost Agent after your live site to hunt down silent bugs, and hands you the fix —
          all before a real user ever sees it.
        </p>

        <ScanForm />
      </section>

      {/* Product mockup */}
      <section className="max-w-4xl mx-auto mt-16 px-6">
        <div className="bg-white rounded-2xl shadow-softLg overflow-hidden">
          <div className="h-10 bg-cream2 flex items-center px-4 gap-1.5 relative">
            <span className="w-2.5 h-2.5 rounded-full bg-berry/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-olive/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-ink-muted">
              vibecheck.dev/scan/acme-labs-shop-app
            </span>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-olive" />
              <span className="font-semibold text-ink">Scan complete — 3 issues found &amp; fixed automatically</span>
            </div>
            <p className="text-xs text-ink-muted mt-1 ml-[18px]">
              47s runtime · 3 viewports tested · 1 patch ready to merge
            </p>

            <div className="grid grid-cols-4 gap-3 mt-6">
              <div className="bg-cream2 rounded-xl p-4">
                <div className="w-7 h-0.5 bg-berry rounded mb-2" />
                <div className="text-[10px] font-semibold text-ink-muted">ERRORS CAUGHT</div>
                <div className="text-xl font-bold text-ink mt-1">3</div>
              </div>
              <div className="bg-cream2 rounded-xl p-4">
                <div className="w-7 h-0.5 bg-olive rounded mb-2" />
                <div className="text-[10px] font-semibold text-ink-muted">VIEWPORTS</div>
                <div className="text-xl font-bold text-ink mt-1">3</div>
              </div>
              <div className="bg-cream2 rounded-xl p-4">
                <div className="w-7 h-0.5 bg-amber-500 rounded mb-2" />
                <div className="text-[10px] font-semibold text-ink-muted">SCAN TIME</div>
                <div className="text-xl font-bold text-ink mt-1">47s</div>
              </div>
              <div className="bg-berry rounded-xl p-4 text-white">
                <div className="text-sm font-semibold">⚡ Patch Generated</div>
                <div className="text-[10px] opacity-80 mt-1">Ready to open as a pull request</div>
              </div>
            </div>

            <div className="font-mono text-[11px] text-ink-muted/80 mt-5 space-y-1">
              <div>[12:04:12] ✗ 500 Internal Server Error on /api/cart → fix applied</div>
              <div>[12:04:20] ✓ Scan complete — 3 issues flagged</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature row */}
      <section className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 px-6 mt-16 pb-24">
        {features.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-7 shadow-soft">
            <div className="w-11 h-11 rounded-xl bg-olive/20 flex items-center justify-center text-xl text-[#5c6339]">
              {f.icon}
            </div>
            <h3 className="font-bold text-ink mt-5">{f.title}</h3>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
