"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the page on an interval while research is running. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
