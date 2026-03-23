import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // Prevent clickjacking
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
];

const allowedOrigins = (process.env.ALLOWED_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsHeaders = [
  { key: "Vary", value: "Origin" },
  {
    key: "Access-Control-Allow-Origin",
    value: allowedOrigins.length === 1 ? allowedOrigins[0] : "null",
  },
  {
    key: "Access-Control-Allow-Methods",
    value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  },
  {
    key: "Access-Control-Allow-Headers",
    value:
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Webhook-Secret",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: corsHeaders,
      },
    ];
  },
};

export default nextConfig;
