# Pool Checker - Telegram Bot

Hệ thống quản lý pool Raydium thông qua Telegram bot với database persistence.

## Tính năng

- ✅ Thêm pool mới từ Telegram bot
- ✅ Lưu trữ pool vào database (SQLite với Prisma)
- ✅ Xem danh sách pools
- ✅ Thống kê pools
- ✅ Tìm kiếm pool theo từ khóa
- ✅ Validation và error handling
- ✅ TypeScript với strict mode

## Cấu trúc Project

```
src/
├── commands/
│   └── telegrambot-command.ts    # Telegram bot implementation
├── database/
│   ├── client.ts                 # Prisma client
│   ├── models/
│   │   └── Pool.ts              # Pool model types
│   └── prisma/
│       └── schema.prisma        # Database schema
├── repository/
│   ├── PoolRepository.ts        # Database operations
│   └── index.ts
├── services/
│   ├── PoolService.ts           # Business logic
│   └── index.ts
└── index.ts
```

## Database Schema

```prisma
model Pool {
  id             String   @id @default(cuid())
  address        String   @unique
  token0Vault    String
  token1Vault    String
  token0Mint     String
  token1Mint     String
  lpMint         String
  configAddress  String
  observationKey String
  isActive       Boolean  @default(true)
}
```

## Sử dụng

### 1. Khởi động Telegram Bot

```bash
# Từ thư mục gốc project
pnpm run pool-checker telegrambot
```

### 2. Các lệnh Telegram Bot

| Lệnh | Mô tả | Ví dụ |
|------|-------|-------|
| `/start` | Khởi động bot | `/start` |
| `/help` | Hiển thị trợ giúp | `/help` |
| `/add` | Thêm pool mới | `/add <pool_address>` |
| `/list` | Xem danh sách pools | `/list` |
| `/stats` | Xem thống kê | `/stats` |
| `/search` | Tìm kiếm pool | `/search <keyword>` |

### 3. Sử dụng trong Code

#### PoolRepository

```typescript
import { PrismaClient } from '../database/client'
import { PoolRepository } from '../repository/PoolRepository'

const prisma = new PrismaClient()
const poolRepo = new PoolRepository(prisma)

// Thêm pool mới
const newPool = await poolRepo.create({
  address: 'pool_address_here',
  token0Vault: 'token0_vault',
  token1Vault: 'token1_vault',
  token0Mint: 'token0_mint',
  token1Mint: 'token1_mint',
  lpMint: 'lp_mint',
  configAddress: 'config_address',
  observationKey: 'observation_key',
  isActive: true
})

// Tìm pool theo địa chỉ
const pool = await poolRepo.findByAddress('pool_address_here')

// Lấy tất cả pools
const allPools = await poolRepo.findAll({
  where: { isActive: true },
  orderBy: { address: 'asc' }
})
```

#### PoolService

```typescript
import { PrismaClient } from '../database/client'
import { PoolService } from '../services/PoolService'

const prisma = new PrismaClient()
const poolService = new PoolService(prisma)

// Thêm pool từ Telegram
const poolKeys = await raydiumClient.fetchPoolKeys(poolAddress)
const createdPool = await poolService.addPoolFromTelegram(poolAddress, poolKeys)

// Lấy pools đang hoạt động
const activePools = await poolService.getActivePools(10)

// Thống kê
const stats = await poolService.getPoolStatistics()
console.log(`Total: ${stats.total}, Active: ${stats.active}`)

// Tìm kiếm
const searchResults = await poolService.searchPools('keyword', 5)
```

## API Reference

### PoolRepository

#### Methods

- `create(data: PoolCreateInput): Promise<Pool>`
- `findByAddress(address: string): Promise<Pool | null>`
- `findById(id: string): Promise<Pool | null>`
- `findAll(options?): Promise<Pool[]>`
- `updateByAddress(address: string, data: PoolUpdateInput): Promise<Pool>`
- `updateById(id: string, data: PoolUpdateInput): Promise<Pool>`
- `deleteByAddress(address: string): Promise<Pool>`
- `deleteById(id: string): Promise<Pool>`
- `count(where?): Promise<number>`
- `existsByAddress(address: string): Promise<boolean>`
- `upsert(address: string, data: PoolCreateInput): Promise<Pool>`

### PoolService

#### Methods

- `addPoolFromTelegram(poolAddress: string, poolKeys: any): Promise<Pool>`
- `getPoolByAddress(poolAddress: string): Promise<Pool | null>`
- `getActivePools(limit?: number): Promise<Pool[]>`
- `getPoolsWithPagination(page?: number, pageSize?: number): Promise<Pool[]>`
- `updatePoolStatus(poolAddress: string, isActive: boolean): Promise<Pool>`
- `deletePool(poolAddress: string): Promise<Pool>`
- `getPoolStatistics(): Promise<{total: number, active: number, inactive: number}>`
- `searchPools(searchTerm: string, limit?: number): Promise<Pool[]>`

## Error Handling

Tất cả các method đều có error handling với:

- Validation errors (invalid pool address, duplicate pools)
- Database errors (connection issues, constraint violations)
- Business logic errors (pool not found, invalid operations)

## Development

### Setup Database

```bash
# Generate Prisma client
cd packages/raydium/commands/pool-checker
npx prisma generate

# Run migrations
npx prisma migrate dev
```

### Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License
