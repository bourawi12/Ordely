-- Additive and nullable: existing shops stay on the free plan (plan IS NULL).
ALTER TABLE "boutiques" ADD COLUMN "plan" VARCHAR(20),
ADD COLUMN "planStartedAt" TIMESTAMPTZ(6),
ADD COLUMN "churnedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "boutiques_createdAt_idx" ON "boutiques"("createdAt");
