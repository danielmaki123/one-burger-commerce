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

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The production image does not load this file at runtime (it imports from
  // ./src, which the runner stage does not ship), so this applies to dev and
  // build only. Strip `X-Powered-By` at the proxy if a deployment needs it.
  poweredByHeader: false,
  agentRules: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: buildVersion,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
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
      {
        // Los frames del landing pesan 3,26 MB. Next sirve lo que está en
        // `public/` con `max-age=0` y un ETag derivado de la fecha del archivo,
        // así que **cada deploy obligaba a todos los clientes a bajarlos de
        // nuevo**. Con un año de caché inmutable solo se bajan una vez; si algún
        // frame cambia, se sube `LANDING_FRAMES_VERSION` y la URL cambia.
        source: "/landing/frames/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

