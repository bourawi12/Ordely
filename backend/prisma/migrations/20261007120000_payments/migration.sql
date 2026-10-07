-- CreateTable (additive: nothing existing changes)
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "boutiqueId" INTEGER NOT NULL,
    "plan" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TND',
    "provider" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "cardBrand" VARCHAR(20),
    "cardLast4" VARCHAR(4),
    "failureReason" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_boutiqueId_createdAt_idx" ON "payments"("boutiqueId", "createdAt");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;
