-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productName" VARCHAR(150) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,3) NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill data from orders table into order_items table before dropping columns
INSERT INTO "order_items" ("orderId", "productName", "quantity", "unitPrice")
SELECT
    "id" AS "orderId",
    COALESCE("item", 'Produit') AS "productName",
    COALESCE("quantity", 1) AS "quantity",
    CASE
        WHEN COALESCE("quantity", 1) > 0 THEN "total" / COALESCE("quantity", 1)
        ELSE "total"
    END AS "unitPrice"
FROM "orders";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "item",
DROP COLUMN "quantity";
