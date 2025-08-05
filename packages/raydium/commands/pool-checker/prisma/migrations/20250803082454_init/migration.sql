-- CreateTable
CREATE TABLE "public"."Pool" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "token0Vault" TEXT NOT NULL,
    "token1Vault" TEXT NOT NULL,
    "token0Mint" TEXT NOT NULL,
    "token1Mint" TEXT NOT NULL,
    "lpMint" TEXT NOT NULL,
    "configAddress" TEXT NOT NULL,
    "observationKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Config" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "mustBoost" BOOLEAN NOT NULL DEFAULT false,
    "totalBoost" INTEGER,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "expiredTime" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "profitAutoSell" DOUBLE PRECISION NOT NULL,
    "jitoTip" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pool_address_key" ON "public"."Pool"("address");
