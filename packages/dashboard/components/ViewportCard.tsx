export function ViewportCard({
  label,
  flagLabel,
  screenshotDataUrl,
}: {
  label: string;
  flagLabel?: string;
  screenshotDataUrl?: string;
}) {
  const flagged = Boolean(flagLabel);
  return (
    <div
      className={`bg-white rounded-xl shadow-soft overflow-hidden ${
        flagged ? "ring-1 ring-berry/40" : ""
      }`}
    >
      <div className="h-4 bg-cream2 flex items-center gap-1 px-2">
        <span className="w-1 h-1 rounded-full bg-ink-muted/40" />
        <span className="w-1 h-1 rounded-full bg-ink-muted/40" />
        <span className="w-1 h-1 rounded-full bg-ink-muted/40" />
      </div>
      {screenshotDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={screenshotDataUrl} alt={label} className="w-full max-h-40 object-cover object-top" />
      ) : (
        <div className="p-2.5 space-y-1.5">
          <div className="h-1.5 rounded bg-cream2 w-full" />
          <div className="h-1.5 rounded bg-cream2 w-4/5" />
          <div className="h-1.5 rounded bg-cream2 w-full" />
          <div className="h-1.5 rounded bg-cream2 w-4/5" />
        </div>
      )}
      <div className="px-2.5 pb-2 pt-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wide text-ink-muted">{label}</span>
      </div>
      {flagged && (
        <div className="mx-2.5 mb-2.5 bg-berry/10 text-berry text-[9px] font-semibold rounded-md py-1.5 text-center">
          {flagLabel}
        </div>
      )}
    </div>
  );
}
