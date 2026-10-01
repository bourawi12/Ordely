-- Orders belong to a shop. Existing orders (shared demo data) go to the oldest shop;
-- if orders exist but no shop does, an empty one is created to own them, so nothing is deleted.
ALTER TABLE "orders" ADD COLUMN "boutiqueId" INTEGER;
INSERT INTO "boutiques" ("name")
  SELECT 'Demo' WHERE EXISTS (SELECT 1 FROM "orders") AND NOT EXISTS (SELECT 1 FROM "boutiques");
UPDATE "orders" SET "boutiqueId" = (SELECT MIN("id") FROM "boutiques");
ALTER TABLE "orders" ALTER COLUMN "boutiqueId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "orders_boutiqueId_status_idx" ON "orders"("boutiqueId", "status");

-- CreateIndex
CREATE INDEX "orders_boutiqueId_createdAt_idx" ON "orders"("boutiqueId", "createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE CASCADE ON UPDATE CASCADE;
