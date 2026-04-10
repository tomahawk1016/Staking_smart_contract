import clsx from "clsx";

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border",
        tone === "neutral" && "bg-white/5 border-white/10 text-white/85",
        tone === "success" && "bg-emerald-400/10 border-emerald-300/20 text-emerald-100",
        tone === "warn" && "bg-amber-400/10 border-amber-300/20 text-amber-100",
      )}
    >
      {children}
    </span>
  );
}

