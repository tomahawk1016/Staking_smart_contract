import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger";
    size?: "sm" | "md";
    loading?: boolean;
  }
>;

export function Button({ variant = "primary", size = "md", loading, disabled, className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-sm",
        variant === "primary" &&
          "bg-brand-500 text-white shadow-glow hover:bg-brand-400 active:bg-brand-500/90",
        variant === "ghost" &&
          "bg-white/5 text-white hover:bg-white/8 border border-white/10",
        variant === "danger" &&
          "bg-red-500/15 text-red-200 hover:bg-red-500/22 border border-red-500/25",
        className,
      )}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/80" />
          <span>Processing…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

