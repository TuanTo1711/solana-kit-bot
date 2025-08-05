# @solana-kit-bot/pumpswap-program

PumpSwap program cho Solana blockchain - một package TypeScript để tương tác với
PumpSwap AMM (Automated Market Maker) pools.

## Tổng quan

Package này cung cấp một client để tương tác với PumpSwap AMM protocol trên
Solana, cho phép:

- Fetch thông tin pool keys và metadata
- Tạo instructions cho buy tokens
- Tạo instructions cho sell tokens
- Tạo instructions cho atomic swap operations

## Cài đặt

```bash
pnpm add @solana-kit-bot/pumpswap-program
```

## Dependencies

- `@solana/kit` - Solana TypeScript SDK
- `@solana-program/token` - Token program utilities
- `@solana-program/system` - System program utilities
- `@solana-program/compute-budget` - Compute budget utilities

## API Reference

### createPumpswapClient

Tạo một instance của PumpswapClient để tương tác với pools.

```typescript
import { createPumpswapClient } from '@solana-kit-bot/pumpswap-program'

const client = createPumpswapClient(rpc)
```

**Parameters:**

- `rpc: Rpc<GetAccountInfoApi>` - Solana RPC client

**Returns:** `PumpswapClient`

### PumpswapClient Interface

#### fetchPoolKeys(poolId)

Fetch thông tin pool keys và metadata cho một pool cụ thể.

```typescript
const poolKeys = await client.fetchPoolKeys(poolAddress)
```

**Parameters:**

- `poolId: string | Address<string>` - Địa chỉ của pool

**Returns:** `Promise<PoolKeys>`

#### createBuyInstructions(params, option)

Tạo sequence of instructions để mua tokens từ PumpSwap pool.

```typescript
const instructions = await client.createBuyInstructions(
  {
    poolKeys,
    buyer,
    maxAmountIn: 1000000, // lamports
    amountOut: 100, // tokens
  },
  {
    hasBaseAta: false,
    hasQuoteAta: false,
  }
)
```

**Parameters:**

- `params: BuyParams` - Thông số cho buy operation
- `option: BuyOption` - Options cho buy operation

**Returns:** `Promise<Instruction[]>`

#### createSellInstructions(params, option)

Tạo sequence of instructions để bán tokens.

```typescript
const instructions = await client.createSellInstructions(
  {
    poolKeys,
    seller,
    amountIn: 100, // tokens
    minAmountOut: 900000, // lamports
  },
  {
    sellAll: false,
    hasQuoteAta: true,
  }
)
```

**Parameters:**

- `params: SellParams` - Thông số cho sell operation
- `option: SellOption` - Options cho sell operation

**Returns:** `Promise<Instruction[]>`

#### createAtomicSwapInstructions(params, option)

Tạo instructions cho atomic swap operations (buy và sell trong cùng
transaction).

```typescript
const instructions = await client.createAtomicSwapInstructions(
  {
    poolKeys,
    payer,
    amountBuy: 1000000,
    amountSell: 50,
  },
  {
    hasBaseAta: true,
    hasQuoteAta: true,
    buyFirst: true,
    minOutIsZero: false,
  }
)
```

**Parameters:**

- `params: AtomicSwapParams` - Thông số cho atomic swap
- `option: AtomicSwapOption` - Options cho atomic swap

**Returns:** `Promise<Instruction[]>`

## Types

### PoolKeys

Thông tin keys và metadata của một pool.

```typescript
type PoolKeys = {
  pool: Address // Địa chỉ pool
  poolBump: number // Pool PDA bump
  index: number // Pool index
  creator: Address // Creator của pool
  baseMint: Address // Base token mint
  quoteMint: Address // Quote token mint (thường là wSOL)
  lpMint: Address // LP token mint
  poolBaseTokenAccount: Address // Pool's base token account
  poolQuoteTokenAccount: Address // Pool's quote token account
  lpSupply: number | bigint // Current LP token supply
  coinCreator: Address // Coin creator address
}
```

### BuyParams

Thông số cho buy operations.

```typescript
type BuyParams = {
  poolKeys: PoolKeys // Pool information
  buyer: TransactionSigner<string> // Buyer's keypair
  maxAmountIn: number | bigint // Maximum SOL to spend
  amountOut: number | bigint // Desired token amount to receive
}
```

### SellParams

Thông số cho sell operations.

```typescript
type SellParams = {
  poolKeys: PoolKeys // Pool information
  seller: TransactionSigner<string> // Seller's keypair
  amountIn: number | bigint // Token amount to sell
  minAmountOut: number | bigint // Minimum SOL to receive
}
```

### AtomicSwapParams

Thông số cho atomic swap operations.

```typescript
type AtomicSwapParams = {
  poolKeys: PoolKeys // Pool information
  payer: TransactionSigner<string> // Transaction payer
  amountBuy: number | bigint // SOL amount for buy
  baseAmountBuy?: number | bigint // Optional: specific token amount to buy
  amountSell: number | bigint // Token amount to sell
}
```

### Options Types

#### BuyOption

```typescript
type BuyOption = {
  hasBaseAta: boolean // Base token ATA đã tồn tại?
  hasQuoteAta: boolean // Quote token ATA đã tồn tại?
}
```

#### SellOption

```typescript
type SellOption = {
  sellAll: boolean // Bán toàn bộ token balance?
  hasQuoteAta: boolean // Quote token ATA đã tồn tại?
}
```

#### AtomicSwapOption

```typescript
type AtomicSwapOption = {
  hasBaseAta: boolean // Base token ATA đã tồn tại?
  hasQuoteAta: boolean // Quote token ATA đã tồn tại?
  buyFirst: boolean // Thực hiện buy trước sell?
  minOutIsZero: boolean // Set minimum output về 0?
}
```

## Examples

### Buy Tokens

```typescript
import { createPumpswapClient } from '@solana-kit-bot/pumpswap-program'
import { address } from '@solana/kit'

const client = createPumpswapClient(rpc)

// Fetch pool information
const poolKeys = await client.fetchPoolKeys(address('POOL_ADDRESS_HERE'))

// Create buy instructions
const buyInstructions = await client.createBuyInstructions(
  {
    poolKeys,
    buyer: buyerKeypair,
    maxAmountIn: 1_000_000, // 0.001 SOL
    amountOut: 100_000, // 100k tokens
  },
  {
    hasBaseAta: false, // Tạo base token ATA nếu chưa có
    hasQuoteAta: false, // Tạo wSOL ATA nếu chưa có
  }
)

// Add to transaction và send
```

### Sell Tokens

```typescript
// Create sell instructions
const sellInstructions = await client.createSellInstructions(
  {
    poolKeys,
    seller: sellerKeypair,
    amountIn: 50_000, // Bán 50k tokens
    minAmountOut: 500_000, // Minimum 0.0005 SOL
  },
  {
    sellAll: false, // Không bán toàn bộ
    hasQuoteAta: true, // wSOL ATA đã tồn tại
  }
)
```

### Atomic Swap

```typescript
// Perform buy và sell trong cùng transaction
const swapInstructions = await client.createAtomicSwapInstructions(
  {
    poolKeys,
    payer: payerKeypair,
    amountBuy: 2_000_000, // 0.002 SOL để buy
    amountSell: 75_000, // 75k tokens để sell
  },
  {
    hasBaseAta: true,
    hasQuoteAta: true,
    buyFirst: true, // Buy trước rồi sell
    minOutIsZero: false,
  }
)
```

## Architecture

Package này được tổ chức thành các module:

- **`client.ts`** - Main PumpswapClient implementation
- **`types/`** - Type definitions và interfaces
- **`generated/`** - Auto-generated code từ Solana program IDL
- **`IDL/`** - Interface Definition Language files

### Generated Code

Code trong thư mục `generated/` được tự động tạo từ program IDL và bao gồm:

- **accounts/** - Account type definitions
- **instructions/** - Instruction builders
- **types/** - Program-specific types
- **errors/** - Error definitions

## Error Handling

Các operations có thể throw errors trong các trường hợp:

- Pool không tồn tại hoặc không hợp lệ
- Insufficient funds cho transaction
- Invalid token amounts
- Network errors khi fetch pool data

Luôn wrap các calls trong try-catch blocks:

```typescript
try {
  const poolKeys = await client.fetchPoolKeys(poolAddress)
  const instructions = await client.createBuyInstructions(params, options)
} catch (error) {
  console.error('PumpSwap operation failed:', error)
}
```

## License

MIT

## Author

Yuuta - To Hoang Tuan
