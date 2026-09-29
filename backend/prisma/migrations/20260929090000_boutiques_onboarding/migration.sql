-- CreateTable
CREATE TABLE "boutiques" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100),
    "businessPhone" VARCHAR(30),
    "platform" VARCHAR(30),
    "sector" VARCHAR(30),
    "deliveryZones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dailyOrderVolume" VARCHAR(20),
    "callLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "callStartTime" VARCHAR(5),
    "callEndTime" VARCHAR(5),
    "confirmationProcess" VARCHAR(30),
    "acquisitionSource" VARCHAR(30),
    "carrier" VARCHAR(30),
    "onboardingCompletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutiques_pkey" PRIMARY KEY ("id")
);

-- Every existing user gets their own empty boutique; they go through the onboarding at next login.
ALTER TABLE "users" ADD COLUMN "boutiqueId" INTEGER;
ALTER TABLE "boutiques" ADD COLUMN "seedUserId" INTEGER;
INSERT INTO "boutiques" ("seedUserId", "createdAt") SELECT "id", "createdAt" FROM "users" ORDER BY "id";
UPDATE "users" u SET "boutiqueId" = b."id" FROM "boutiques" b WHERE b."seedUserId" = u."id";
ALTER TABLE "boutiques" DROP COLUMN "seedUserId";
ALTER TABLE "users" ALTER COLUMN "boutiqueId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "users_boutiqueId_idx" ON "users"("boutiqueId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
