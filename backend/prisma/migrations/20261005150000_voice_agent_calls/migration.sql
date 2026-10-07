-- Additive and nullable: existing calls are untouched.
ALTER TABLE "calls" ADD COLUMN "dispatchedAt" TIMESTAMPTZ(6),
ADD COLUMN "providerCallId" VARCHAR(64),
ADD COLUMN "transcriptParts" JSONB,
ADD COLUMN "recordingKeys" JSONB;

-- CreateIndex
CREATE INDEX "calls_status_dispatchedAt_idx" ON "calls"("status", "dispatchedAt");
