import Link from "next/link";

export function Navbar({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  return (
    <nav className="flex items-center h-20 px-8 md:px-16">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-berry to-olive flex items-center justify-center">
          <span className="text-white text-xs font-bold">{"</>"}</span>
        </div>
        <div>
          <div className="font-bold text-ink leading-none">VibeCheck</div>
          {variant === "app" && (
            <div className="text-[9px] font-semibold tracking-wider text-ink-muted mt-0.5">QA AUDITOR</div>
          )}
        </div>
      </Link>

      {variant === "marketing" && (
        <>
          <div className="hidden md:flex items-center gap-10 ml-16 text-sm font-medium text-ink-muted">
            <Link href="#product" className="hover:text-ink transition-colors">
              Product
            </Link>
            <Link href="#docs" className="hover:text-ink transition-colors">
              Docs
            </Link>
            <Link href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </Link>
          </div>
          <Link
            href="/dashboard"
            className="ml-auto bg-berry text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Try Free
          </Link>
        </>
      )}
    </nav>
  );
}
