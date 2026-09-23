-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "phone" VARCHAR(30) NOT NULL DEFAULT '',
ADD COLUMN     "total" DECIMAL(10,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "calls" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "durationSeconds" INTEGER,
    "language" VARCHAR(30),
    "transcript" JSONB,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_orderId_idx" ON "calls"("orderId");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_createdAt_idx" ON "calls"("createdAt");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- "completed" orders are now called "confirmed".
UPDATE "orders" SET "status" = 'confirmed' WHERE "status" = 'completed';
