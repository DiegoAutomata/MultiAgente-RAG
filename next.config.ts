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
  // Keep heavy native/CJS modules out of Turbopack bundle so require() works correctly
  serverExternalPackages: ['pdf-parse', '@xenova/transformers'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking — page can't be embedded in an iframe
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Force HTTPS for 1 year (only effective when deployed with HTTPS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Stop referrer leaking to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-inline' needed for Next.js hydration scripts (inline event handlers)
              // 'unsafe-eval' needed in development for React DevTools callstack reconstruction
              // In production builds, Next.js is compiled and doesn't need eval()
              "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""),
              "style-src 'self' 'unsafe-inline'",
              // Supabase API + Anthropic API calls from server-side (fetch) are not restricted by CSP
              // Only browser-initiated requests matter here
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
