import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
    useTypeScriptCli: false,
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
