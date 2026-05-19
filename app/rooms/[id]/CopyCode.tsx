"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-sm tracking-widest hover:bg-white/10"
    >
      <span className="select-all">{code}</span>
      <span className="text-[10px] uppercase tracking-widest text-white/50">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
