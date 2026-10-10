CREATE TABLE "reclamations" (
    "id" SERIAL NOT NULL,
    "boutiqueId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "subject" VARCHAR(150) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "reclamations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reclamations_boutiqueId_createdAt_idx" ON "reclamations"("boutiqueId", "createdAt");
CREATE INDEX "reclamations_status_createdAt_idx" ON "reclamations"("status", "createdAt");
CREATE INDEX "reclamations_orderId_idx" ON "reclamations"("orderId");
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;