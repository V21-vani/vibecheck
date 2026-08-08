import type { LogLine } from "@/lib/types";

const levelColor: Record<LogLine["level"], string> = {
  info: "text-cream2/70",
  warn: "text-amber-300",
  error: "text-rose-300",
  success: "text-lime-300",
};

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export function LogPanel({ lines }: { lines: LogLine[] }) {
  return (
    <div className="bg-ink rounded-2xl shadow-soft p-5 h-[280px] overflow-y-auto font-mono text-[11.5px] leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className={levelColor[line.level]}>
          [{fmtTime(line.timestamp)}] {line.message}
        </div>
      ))}
    </div>
  );
}
