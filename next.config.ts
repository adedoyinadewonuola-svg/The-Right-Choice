import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname),
  },
  // Local sandbox/preview only: allow the proxied dev origin (non-localhost hostname).
  allowedDevOrigins: ["*.e2b.app"],
  async headers() {
    return [
      {
        // No CSP on purpose: a strict policy fights Turbopack's dev-time inline scripts and
        // Tailwind's inline styles. Add one when the app is served over HTTPS for real.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
