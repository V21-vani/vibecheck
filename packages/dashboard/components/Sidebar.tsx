import type { ScanReport } from "@/lib/types";

const navItems = [
  { label: "Overview", active: true },
  { label: "Chaos Sweep Logs", active: false },
  { label: "Visual Inspection", active: false },
  { label: "Patches & PRs", active: false },
];

function describeTarget(repo: string): { name: string; sub: string } {
  try {
    const url = new URL(repo);
    const path = url.pathname === "/" ? "" : url.pathname;
    return { name: url.hostname, sub: path || url.hostname };
  } catch {
    const name = repo.split("/").slice(-1)[0] || repo;
    const org = repo.split("/").slice(-2, -1)[0] || "";
    return { name, sub: org };
  }
}

export function Sidebar({ meta }: { meta: ScanReport["meta"] }) {
  const { name, sub } = describeTarget(meta.repo);

  return (
    <aside className="w-62 shrink-0 bg-white border-r border-ink/5 min-h-[calc(100vh-5rem)] py-6 px-5">
      <div className="bg-cream2 rounded-xl p-4 mb-6">
        <div className="font-bold text-sm text-ink truncate" title={meta.repo}>
          {name}
        </div>
        <div className="text-xs text-ink-muted mt-1 truncate" title={sub}>
          {meta.branch} · {sub}
        </div>
        <span className="inline-block mt-3 bg-olive/20 text-[#5c6339] text-[10px] font-semibold px-3 py-1 rounded-md">
          {meta.framework}
        </span>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`relative pl-4 pr-3 py-2.5 rounded-lg text-sm ${
              item.active ? "bg-berry/10 text-berry font-semibold" : "text-ink-muted font-medium"
            }`}
          >
            {item.active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-berry" />
            )}
            {item.label}
          </div>
        ))}
      </nav>
    </aside>
  );
}
