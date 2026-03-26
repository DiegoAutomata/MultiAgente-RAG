import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
  },
  // Exclude Python venv from file tracing (symlinks in venv break Turbopack)
  outputFileTracingExcludes: {
    '*': ['./venv/**'],
  },
}

export default nextConfig
