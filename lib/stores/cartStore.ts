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

      // Keep the `set` updater pure — fire side effects (toasts) after it, so
      // React 18 StrictMode double-invocation can't emit duplicate toasts.
      addItem: (item) => {
        const state = get()
        const existingItemIndex = state.items.findIndex((i) => i.beat_id === item.beat_id)

        if (existingItemIndex >= 0) {
          const newItems = [...state.items]
          newItems[existingItemIndex] = item
          set({ items: newItems, isOpen: true })
          showToast.success(`Updated ${item.title} license to ${item.license_type}`)
        } else {
          set({ items: [...state.items, item], isOpen: true })
          showToast.success(`Added ${item.title} to cart`)
        }
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
      // Only persist the cart contents — never the drawer's open state, which
      // would otherwise pop the cart open on every reload.
      partialize: (state) => ({ items: state.items }),
    }
  )
)

