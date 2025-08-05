export type BuyOption = {
  hasBaseAta: boolean
  hasQuoteAta: boolean
}

export type SellOption = {
  sellAll: boolean
  hasQuoteAta: boolean
}

export type AtomicSwapOption = {
  hasBaseAta: boolean
  hasQuoteAta: boolean
  buyFirst: boolean
  minOutIsZero: boolean
}
