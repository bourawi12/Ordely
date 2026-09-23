import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build used by the Docker image.
  output: "standalone",
};

export default nextConfig;
