import type { NextConfig } from "next";

const appHostname = process.env.PEEK_APP_URL
  ? new URL(process.env.PEEK_APP_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  transpilePackages: ['@peektravel/app-utilities'],
  allowedDevOrigins: appHostname
    ? [appHostname, "**.peek.com"]
    : ["**.peek.com"],
  async headers() {
    // Only Peek Pro may embed this app. Allow any peek.com / peek.stack host at
    // any subdomain depth (e.g. foo.peek.com, foo.dev.peek.com, foo.stage.peek.com).
    // A CSP `*.peek.com` host-source matches any number of leading labels, so it
    // covers nested subdomains; the bare hosts cover the apex.
    // frame-ancestors supersedes X-Frame-Options in modern browsers.
    const frameAncestors =
      "frame-ancestors 'self' *.peek.com peek.com *.peek.stack peek.stack";
    return [
      {
        // Applies to every route, not just the initial embedded entry route.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: frameAncestors,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
