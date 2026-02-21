import { create } from "zustand"
import { persist } from "zustand/middleware"

interface WalletState {
  address: string | null
  connected: boolean
  setWallet: (addr: string) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      connected: false,

      setWallet: (addr) =>
        set({
          address: addr,
          connected: true,
        }),

      disconnect: () =>
        set({
          address: null,
          connected: false,
        }),
    }),
    {
      name: "hush-wallet",
    }
  )
)