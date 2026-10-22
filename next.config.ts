import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      // Only generated, content-hashed delivery assets are immutable.
      source: "/images/exterminator/optimized/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
};

export default nextConfig;
