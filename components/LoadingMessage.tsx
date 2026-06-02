"use client";

import { useState, useEffect } from "react";

export function useLoadingMessages(messages: string[], active: boolean, intervalMs = 2200) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) { setIdx(0); return; }
    const t = setInterval(() => setIdx(i => (i + 1) % messages.length), intervalMs);
    return () => clearInterval(t);
  }, [active, messages.length, intervalMs]);
  return active ? messages[idx] : "";
}

export function LoadingDots({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-[var(--muted-foreground)]">
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-[var(--accent-green)] inline-block animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
      <span className="transition-all duration-500">{message}</span>
    </div>
  );
}
