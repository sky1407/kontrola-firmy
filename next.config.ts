import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // V domovskom priečinku leží cudzí package-lock.json – koreň projektu určíme explicitne.
  turbopack: { root: __dirname },
};

export default nextConfig;
