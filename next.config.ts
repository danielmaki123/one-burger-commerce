import { execSync } from "node:child_process";
import type { NextConfig } from "next";

import {
  createTimestampBuildVersion,
  resolveAppBuildVersion,
} from "./src/shared/config/app-version";

const buildVersion = resolveAppBuildVersion({
  getGitShortSha: () => {
    try {
      return execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return null;
    }
  },
  getBuildFallbackVersion: () => createTimestampBuildVersion(),
});

process.env.NEXT_PUBLIC_APP_VERSION = buildVersion;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: buildVersion,
  },
  async headers() {
    return [
      {
        source: "/admin",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

