import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false })
import { CurrencyProvider } from '@/lib/providers/CurrencyProvider'
import { Toaster } from 'react-hot-toast'

// Lazy-load WaveSurfer player — it's ~200KB and not needed on initial render
const GlobalPlayer = dynamic(() => import('@/components/player/GlobalPlayer'), { ssr: false })

const inter = Inter({ subsets: ['latin'], display: 'swap' })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'BeatToday | The Premium Beat Marketplace',
  description: 'License high-quality instrumentals to power your next hit. Buy and sell beats from top global producers.',
  openGraph: {
    title: 'BeatToday | The Premium Beat Marketplace',
    description: 'License high-quality instrumentals from top global producers.',
    url: 'https://beattoday.com',
    siteName: 'BeatToday',
    images: [
      {
        url: 'https://beattoday.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'BeatToday Marketplace',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BeatToday | The Premium Beat Marketplace',
    description: 'License high-quality instrumentals to power your next hit.',
    images: ['https://beattoday.com/og-image.jpg'],
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CurrencyProvider>
          <Navbar />
          {/* pb-24 on mobile ensures fixed player bar doesn't cover page content */}
          <main className="min-h-screen pb-24 md:pb-0">
            {children}
          </main>
          <Footer />
          <GlobalPlayer />
          <CartDrawer />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1a1a1a',
                color: '#ffffff',
                border: '1px solid #333',
              },
            }}
          />
        </CurrencyProvider>
      </body>
    </html>
  )
}
