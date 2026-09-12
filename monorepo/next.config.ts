import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  output: "standalone",
  allowedDevOrigins: ["*.iyetest.my.id", "*.simas.iyetest.my.id", "simas.iyetest.my.id"],
};

export default nextConfig;
