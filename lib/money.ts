/** Wallets and ledger balances are settled in GHS, independently of catalog USD prices. */
export function formatWalletMoney(value: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(value))
}
