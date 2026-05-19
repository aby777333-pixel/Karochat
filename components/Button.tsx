"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-neon-blue text-ink-900 shadow-glow-blue hover:bg-neon-blue/90",
        variant === "ghost" &&
          "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        variant === "danger" &&
          "bg-neon-red text-white shadow-glow-red hover:bg-neon-red/90",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
