"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While research is running: asks the server to run the next step, then refreshes the page.
 * advanceUrl is the route that runs a step (one report or all running reports).
 */
export function AutoRefresh({ seconds, advanceUrl }: { seconds: number; advanceUrl?: string }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    const tickOnce = async () => {
      if (advanceUrl) { try { await fetch(advanceUrl, { method: "POST" }); } catch { /* retry on next tick */ } }
      if (!stopped) router.refresh();
    };
    const t = setInterval(tickOnce, seconds * 1000);
    void tickOnce();
    return () => { stopped = true; clearInterval(t); };
  }, [router, seconds, advanceUrl]);
  return null;
}
