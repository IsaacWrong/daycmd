import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: [
    "better-sqlite3",
    "googleapis",
    "octokit",
    "node-cron",
    "chokidar",
    "@anthropic-ai/sdk",
    "gray-matter",
  ],
};

export default nextConfig;
