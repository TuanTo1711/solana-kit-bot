-- CreateTable
CREATE TABLE "public"."PumpSwapPool" (
    "pool" TEXT NOT NULL,
    "poolBump" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "creator" TEXT NOT NULL,
    "baseMint" TEXT NOT NULL,
    "quoteMint" TEXT NOT NULL,
    "lpMint" TEXT NOT NULL,
    "poolBaseTokenAccount" TEXT NOT NULL,
    "poolQuoteTokenAccount" TEXT NOT NULL,
    "lpSupply" BIGINT NOT NULL,
    "coinCreator" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,

    CONSTRAINT "PumpSwapPool_pkey" PRIMARY KEY ("pool")
);

-- CreateTable
CREATE TABLE "public"."Pool" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "token0Vault" TEXT NOT NULL,
    "token1Vault" TEXT NOT NULL,
    "token0Mint" TEXT NOT NULL,
    "token1Mint" TEXT NOT NULL,
    "lpMint" TEXT NOT NULL,
    "ammConfig" TEXT NOT NULL,
    "observationKey" TEXT NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Config" (
    "id" TEXT NOT NULL,
    "target" BIGINT NOT NULL,
    "hasBoost" BOOLEAN NOT NULL DEFAULT false,
    "totalBoost" INTEGER,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "expiresHour" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "profitSell" INTEGER NOT NULL,
    "jitoTip" BIGINT NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PumpSwapPool_baseMint_idx" ON "public"."PumpSwapPool"("baseMint");

-- CreateIndex
CREATE INDEX "PumpSwapPool_pool_idx" ON "public"."PumpSwapPool"("pool");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_address_key" ON "public"."Pool"("address");
