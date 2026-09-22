import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/msm-template.xlsx is the reference layout the generator follows. Keep it with the function.
  outputFileTracingIncludes: {
    "/api/reports/[id]/excel": ["./data/**"],
  },
};

export default nextConfig;
