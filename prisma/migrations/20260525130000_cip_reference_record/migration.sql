-- Shooters World / CIP Reference Center.
--
-- Additive migration. Adds three enums and one table. Touches no existing
-- table or column. Safe to apply against any in-place database.
--
-- Safety: this table captures published CIP / Shooters World reference
-- metadata only. The app never converts these rows into a per-handload
-- pressure prediction, charge recommendation, or safe/unsafe verdict.
-- User-facing views display only VERIFIED rows; admin reviewers promote
-- DRAFT and PENDING_REVIEW rows.

-- CreateEnum: CipReferenceVerificationStatus.
CREATE TYPE "CipReferenceVerificationStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'VERIFIED',
  'RETIRED'
);

-- CreateEnum: CipReferencePressureUnit.
CREATE TYPE "CipReferencePressureUnit" AS ENUM (
  'BAR',
  'MPA',
  'PSI'
);

-- CreateEnum: CipReferenceVolumeUnit.
CREATE TYPE "CipReferenceVolumeUnit" AS ENUM (
  'CM3',
  'ML',
  'GRAIN_H2O'
);

-- CreateTable: CipReferenceRecord.
CREATE TABLE "CipReferenceRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "cartridgeName" TEXT NOT NULL,
  "cartridgeCaliberLabel" TEXT,
  "powderManufacturer" TEXT,
  "powderFamily" TEXT,
  "powderName" TEXT,
  "sourceUrl" TEXT,
  "sourceLabel" TEXT,
  "sourceRevision" TEXT,
  "sourceDate" TIMESTAMP(3),
  "pmaxValue" DOUBLE PRECISION,
  "pmaxUnit" "CipReferencePressureUnit",
  "referenceChamberVolume" DOUBLE PRECISION,
  "referenceCombustionVolume" DOUBLE PRECISION,
  "volumeUnit" "CipReferenceVolumeUnit",
  "riflingF" DOUBLE PRECISION,
  "riflingZ" DOUBLE PRECISION,
  "riflingG" DOUBLE PRECISION,
  "notes" TEXT,
  "verificationStatus" "CipReferenceVerificationStatus" NOT NULL DEFAULT 'DRAFT',
  "verifiedByEmail" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CipReferenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex.
CREATE INDEX "CipReferenceRecord_workspaceId_idx" ON "CipReferenceRecord"("workspaceId");
CREATE INDEX "CipReferenceRecord_workspaceId_verificationStatus_idx" ON "CipReferenceRecord"("workspaceId", "verificationStatus");
CREATE INDEX "CipReferenceRecord_cartridgeName_idx" ON "CipReferenceRecord"("cartridgeName");
CREATE INDEX "CipReferenceRecord_powderManufacturer_powderName_idx" ON "CipReferenceRecord"("powderManufacturer", "powderName");

-- AddForeignKey.
ALTER TABLE "CipReferenceRecord" ADD CONSTRAINT "CipReferenceRecord_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
