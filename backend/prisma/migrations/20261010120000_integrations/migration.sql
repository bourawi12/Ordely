CREATE TABLE "integrations" (
    "id" SERIAL NOT NULL,
    "boutiqueId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL DEFAULT 'Custom website',
    "apiKeyHash" VARCHAR(64) NOT NULL,
    "apiKeyPrefix" VARCHAR(20) NOT NULL,
    "webhookUrl" VARCHAR(500),
    "webhookSecret" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integrations_boutiqueId_key" ON "integrations"("boutiqueId");
CREATE UNIQUE INDEX "integrations_apiKeyHash_key" ON "integrations"("apiKeyHash");
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "source" VARCHAR(30), ADD COLUMN "externalOrderId" VARCHAR(120);
CREATE UNIQUE INDEX "orders_boutiqueId_externalOrderId_key" ON "orders"("boutiqueId", "externalOrderId");