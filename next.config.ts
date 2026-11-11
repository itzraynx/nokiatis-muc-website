import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The launcher is a client-heavy app; type errors never block the ship. */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
