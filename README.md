# Solana Kit Bot

A comprehensive Solana trading bot framework with advanced features for
automated trading, pool monitoring, and strategy execution.

## 🚀 Features

- **Pool Monitoring**: Real-time monitoring of Raydium pools
- **Automated Trading**: Buy/sell execution with configurable strategies
- **Boost Detection**: DexScreener integration for boost monitoring
- **Telegram Notifications**: Real-time alerts and notifications
- **Multi-Strategy Support**: Various execution and pricing strategies
- **Database Integration**: PostgreSQL with Prisma ORM
- **CLI Interface**: Easy-to-use command-line interface

## 📦 Project Structure

```
solana-kit-bot/
├── app/
│   ├── cli/                 # Command-line interface
│   ├── docs/               # Documentation
│   └── web/                # Web interface (future)
├── packages/
│   ├── core/               # Core bot framework
│   ├── provider/           # RPC provider management
│   ├── pumpswap/           # PumpSwap integration
│   └── raydium/            # Raydium DEX integration
│       ├── commands/
│       │   ├── pool-checker/  # Pool monitoring & trading
│       │   └── virtual-trading/ # Virtual trading simulation
│       ├── cpmm/           # Constant Product Market Maker
│       └── launchlab/      # LaunchLab integration
├── docker/                 # Docker configuration
└── docker-compose.yml      # Development environment
```

## 🛠️ Installation

### Prerequisites

- Node.js 18+
- pnpm
- Docker & Docker Compose
- PostgreSQL

### Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd solana-kit-bot
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Start development environment**

```bash
docker-compose up -d
```

4. **Run database migrations**

```bash
cd packages/raydium/commands/pool-checker
pnpm prisma migrate dev
```

## 🎯 Quick Start

### Pool Checker

Monitor and trade on Raydium pools:

```bash
# Run pool checker
pnpm --filter @solana-kit-bot/raydium-commands executor run

# Configure pool monitoring
pnpm --filter @solana-kit-bot/raydium-commands config add
```

### Virtual Trading

Test strategies without real money:

```bash
pnpm --filter @solana-kit-bot/raydium-commands virtual-trading run
```

## 📋 Configuration

### Pool Checker Config

```typescript
{
  target: "1.0",           // Target pool threshold (SOL)
  mustBoost: true,          // Require active boosts
  totalBoost: 100,          // Required boost amount
  hasImage: true,           // Require token image
  expiredTime: 24,          // Expiration time (hours)
  amount: "0.1",            // Buy amount (SOL)
  profitAutoSell: 50,       // Auto-sell profit %)
  jitoTip: 0.001           // Jito MEV tip (SOL)
}
```

## 🔧 Development

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @solana-kit-bot/core build
```

### Test

```bash
# Run tests
pnpm test

# Run specific package tests
pnpm --filter @solana-kit-bot/core test
```

### Database

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Reset database
pnpm prisma migrate reset
```

## 📚 Documentation

- [Core Framework](./packages/core/README.md)
- [Raydium Integration](./packages/raydium/README.md)
- [Pool Checker](./packages/raydium/commands/pool-checker/README.md)
- [CLI Commands](./app/cli/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## ⚠️ Disclaimer

This software is for educational and research purposes. Use at your own risk.
The authors are not responsible for any financial losses incurred through the
use of this software.

## 🆘 Support

- Create an issue for bugs or feature requests
- Join our community for discussions
- Check the documentation for common questions
