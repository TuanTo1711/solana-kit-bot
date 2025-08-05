/*
  Warnings:

  - You are about to drop the column `configAddress` on the `Pool` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Pool` table. All the data in the column will be lost.
  - Added the required column `ammConfig` to the `Pool` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Pool" DROP COLUMN "configAddress",
DROP COLUMN "isActive",
ADD COLUMN     "ammConfig" TEXT NOT NULL;
