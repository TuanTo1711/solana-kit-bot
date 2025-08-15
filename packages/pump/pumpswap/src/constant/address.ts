import { ASSOCIATED_TOKEN_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token'
import { type Address, address } from '@solana/kit'

import { PUMP_AMM_PROGRAM_ADDRESS } from '../generated'

export type SwapAddresses = {
  program: Address
  globalConfig: Address
  protocolFeeRecipient: Address
  protocolFeeRecipientTokenAccount: Address
  baseTokenProgram: Address
  quoteTokenProgram: Address
  eventAuthority: Address
  associatedTokenProgram: Address
}

export const PROTOCOL_FEE_RECIPENTS = [
  ['62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV', '94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb'],
  ['7VtfL8fvgNfhz17qKRMjzQEXgbdpnHHHQRh54R9jP2RJ', '7GFUN3bWzJMKMRZ34JLsvcqdssDbXnp589SiE33KVwcC'],
  ['7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX', 'X5QPJcpph4mBAJDzc4hRziFftSbcygV59kRb2Fu6Je1'],
  ['9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz', 'Bvtgim23rfocUzxVX9j9QFxTbBnH8JZxnaGLCEkXvjKS'],
  ['AVmoTthdrX6tKt4nDjco2D775W2YK3sDhxPcMmzUAmTY', 'FGptqdxjahafaCzpZ1T6EDtCzYMv7Dyn5MgBLyB3VUFW'],
  ['FWsW1xNtWscwNmKv6wVsU1iTzRN6wmmk3MjxRP5tT7hz', '7xQYoUjUJF1Kg6WVczoTAkaNhn5syQYcbvjmFrhjWpx'],
  ['G5UZAVbAf46s7cKWoyKu8kYTip9DGTpbLZ2qa9Aq69dP', 'BWXT6RUhit9FfJQM3pBmqeFLPYmuxgmyhMGC5sGr8RbA'],
  ['JCRGumoE9Qi5BBgULTgdgTLjSgkCMSbF62ZZfGs84JeU', 'DWpvfqzGWuVy9jVSKSShdM2733nrEsnnhsUStYbkj6Nn'],
] as const satisfies Array<[string, string]>

export const GLOBAL_CONFIG = address('ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw')
export const EVENT_AUTHORITY = address('GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR')

export function getRandomProtocolFeeRecipientPair(): [Address, Address] {
  const index = Math.floor(Math.random() * PROTOCOL_FEE_RECIPENTS.length)
  return PROTOCOL_FEE_RECIPENTS[index] as [Address, Address]
}

export function getSwapAddresses(): SwapAddresses {
  const [recipient, recipientTokenAccount] = getRandomProtocolFeeRecipientPair()
  return {
    program: PUMP_AMM_PROGRAM_ADDRESS,
    globalConfig: GLOBAL_CONFIG,
    protocolFeeRecipient: recipient,
    protocolFeeRecipientTokenAccount: recipientTokenAccount,
    baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
    eventAuthority: EVENT_AUTHORITY,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  }
}
