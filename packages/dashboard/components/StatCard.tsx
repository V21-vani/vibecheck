export function StatCard({ label, value, accentClass }: { label: string; value: string; accentClass: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 flex-1 min-w-[150px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${accentClass}`} />
        <span className="text-[11px] font-semibold tracking-wide text-ink-muted">{label}</span>
      </div>
      <div className="text-3xl font-bold text-ink">{value}</div>
    </div>
  );
}
