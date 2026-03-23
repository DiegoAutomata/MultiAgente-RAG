import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
    // NOTE: serverActions config REMOVED — it was causing Turbopack to misclassify
    // the /api/upload Route Handler as a Server Action (x-nextjs-action-not-found).
    // serverActions are enabled by default in Next.js 15+; no config needed.
  },
}

export default nextConfig
