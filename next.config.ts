import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't let `next dev` generate an AGENTS.md in the project root.
  agentRules: false,
  // The mock API and its datasets are a separate process reached over HTTP.
  // Keep them out of server output tracing so they never ship with the app.
  outputFileTracingExcludes: {
    "*": ["mock-api/**"],
  },
};

export default nextConfig;
