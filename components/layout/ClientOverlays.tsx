'use client'
import dynamic from 'next/dynamic'
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false })
const GlobalPlayer = dynamic(() => import('@/components/player/GlobalPlayer'), { ssr: false })
export default function ClientOverlays() {
  return <><CartDrawer /><GlobalPlayer /></>
}
