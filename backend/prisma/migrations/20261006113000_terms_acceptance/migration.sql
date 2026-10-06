-- AlterTable
ALTER TABLE "users" ADD COLUMN "acceptedTermsAt" TIMESTAMPTZ(6),
ADD COLUMN "termsVersion" VARCHAR(20),
ADD COLUMN "privacyVersion" VARCHAR(20);
