import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build used by the Docker image.
  output: "standalone",
  experimental: {
    // Profile pictures go through a server action (2 MB max, checked by the API).
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
