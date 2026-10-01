-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordChangedAt" TIMESTAMPTZ(6),
ADD COLUMN     "passwordResetExpiresAt" TIMESTAMPTZ(6),
ADD COLUMN     "passwordResetSentAt" TIMESTAMPTZ(6),
ADD COLUMN     "passwordResetTokenHash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "users_passwordResetTokenHash_key" ON "users"("passwordResetTokenHash");
