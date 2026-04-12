/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h CDN cache for images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zinihlwafqvuaznisjcw.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Reduce bundle size by externalizing heavy server-only deps
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
