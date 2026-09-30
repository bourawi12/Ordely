-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerifiedAt" TIMESTAMPTZ(6),
ADD COLUMN     "emailVerifyExpiresAt" TIMESTAMPTZ(6),
ADD COLUMN     "emailVerifySentAt" TIMESTAMPTZ(6),
ADD COLUMN     "emailVerifyTokenHash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerifyTokenHash_key" ON "users"("emailVerifyTokenHash");

-- Backfill: accounts created before verification existed keep their access.
UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
