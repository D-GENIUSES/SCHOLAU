import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@scholau/api", "@scholau/core", "@scholau/tokens"],
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "scholau.vercel.app" }], destination: "https://scholau.com/:path*", permanent: true }];
  },
  async headers() {
    return [{ source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] }, { source: "/brand/splash-logo.svg", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] }, { source: "/:path*", headers: securityHeaders }, { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }, { source: "/push-sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};

export default nextConfig;
