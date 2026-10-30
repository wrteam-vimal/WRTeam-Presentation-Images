import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md on `next dev`; it would end up in the images repo.
  agentRules: false,
};

export default nextConfig;
