/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      // Compatible baseline. Script nonces need a separately tested rollout.
      {key:'Content-Security-Policy',value:"base-uri 'self'; object-src 'none'; frame-ancestors 'none'"},
    ]}]
  },
  poweredByHeader: false,
  images: {
    // Render's small single instance is CPU-bound; its on-the-fly image
    // optimizer chokes when a page loads many images at once (the homepage was
    // requesting 3840px-wide variants and stalling for minutes). We already
    // store reasonably-sized webp on R2 (free egress), so serve them directly
    // and skip the optimizer entirely.
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h CDN cache for images
    remotePatterns: [
      // Cloudflare R2 public bucket (covers, previews, avatars)
      {
        protocol: 'https',
        hostname: '**.r2.dev',
        port: '',
        pathname: '/**',
      },
      // Legacy Supabase public buckets (kept during/after migration)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Tree-shake heavy client libs so only the used icons/functions ship.
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
}

module.exports = nextConfig
