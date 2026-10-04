-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "completedAt" TIMESTAMPTZ(6),
ADD COLUMN     "dispatchedAt" TIMESTAMPTZ(6),
ADD COLUMN     "disposition" VARCHAR(20),
ADD COLUMN     "failureReason" VARCHAR(500),
ADD COLUMN     "isSimulated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "providerCallId" VARCHAR(100),
ADD COLUMN     "taskId" VARCHAR(36),
ADD COLUMN     "transportPhase" VARCHAR(20);

-- CreateTable
CREATE TABLE "call_recordings" (
    "id" SERIAL NOT NULL,
    "callId" INTEGER NOT NULL,
    "speaker" VARCHAR(20) NOT NULL,
    "objectKey" VARCHAR(500) NOT NULL,
    "sizeBytes" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_transcript_entries" (
    "id" SERIAL NOT NULL,
    "callId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "speaker" VARCHAR(20) NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_transcript_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_recordings_callId_speaker_key" ON "call_recordings"("callId", "speaker");

-- CreateIndex
CREATE UNIQUE INDEX "call_transcript_entries_callId_sequence_key" ON "call_transcript_entries"("callId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "calls_taskId_key" ON "calls"("taskId");

-- CreateIndex
CREATE INDEX "calls_taskId_idx" ON "calls"("taskId");

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_transcript_entries" ADD CONSTRAINT "call_transcript_entries_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;