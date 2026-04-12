import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { showToast } from '@/lib/utils/toast'

export type LicenseType = 'mp3' | 'wav' | 'trackout' | 'exclusive'

export interface CartItem {
  beat_id: string
  title: string
  producer_name: string
  cover_url: string
  license_type: LicenseType
  price: number
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  
  // Actions
  addItem: (item: CartItem) => void
  removeItem: (beat_id: string) => void
  clearCart: () => void
  setIsOpen: (isOpen: boolean) => void
  toggleCart: () => void
  
  // Computed
  getTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        set((state) => {
          // Check if beat already in cart
          const existingItemIndex = state.items.findIndex((i) => i.beat_id === item.beat_id)
          
          if (existingItemIndex >= 0) {
            // Upgrade/Change license if already in cart
            const newItems = [...state.items]
            newItems[existingItemIndex] = item
            showToast.success(`Updated ${item.title} license to ${item.license_type}`)
            return { items: newItems, isOpen: true }
          }
          
          showToast.success(`Added ${item.title} to cart`)
          return { items: [...state.items, item], isOpen: true }
        })
      },

      removeItem: (beat_id) => {
        set((state) => ({
          items: state.items.filter((i) => i.beat_id !== beat_id)
        }))
      },

      clearCart: () => set({ items: [] }),
      setIsOpen: (isOpen) => set({ isOpen }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      getTotal: () => {
        return get().items.reduce((total, item) => total + item.price, 0)
      }
    }),
    {
      name: 'beattoday-cart', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
)

