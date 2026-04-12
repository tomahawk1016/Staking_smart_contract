import type { PropsWithChildren } from "react";
import clsx from "clsx";

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("glass rounded-2xl p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]", className)}>
      {children}
    </div>
  );
}

