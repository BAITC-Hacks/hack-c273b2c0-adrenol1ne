import type { NextConfig } from "next";
import { resolve } from "node:path";
const config: NextConfig = {
  turbopack: { root: resolve(process.cwd()) },
  outputFileTracingRoot: resolve(process.cwd()),
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
