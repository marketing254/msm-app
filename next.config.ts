import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Excel fallback route reads data/msm-template.xlsx at runtime.
  // Make sure Vercel bundles it with the serverless function.
  outputFileTracingIncludes: {
    "/api/reports/[id]/excel": ["./data/**"],
  },
};

export default nextConfig;
