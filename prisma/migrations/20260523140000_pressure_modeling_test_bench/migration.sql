-- Pressure modeling test bench (EXPERIMENTAL).
-- These tables exist so the team can record what a future, expert-validated
-- internal-ballistics model would need to ingest, and to capture reference
-- data (published or lab-measured) against which a future solver could be
-- checked. Nothing in this app computes pressure from these rows. The fields
-- are stores, not formulas.

-- CreateEnum
CREATE TYPE "PressureModelStatus" AS ENUM ('DRAFT', 'READY_FOR_EXPERT_REVIEW', 'BLOCKED', 'VALIDATED_REFERENCE', 'REJECTED');

-- CreateTable
CREATE TABLE "PressureModelVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PressureModelStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressureModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressureValidationRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "loadId" TEXT,
    "sourceId" TEXT,
    "modelVersionId" TEXT,
    "referenceLabel" TEXT NOT NULL,
    "referencePressurePsi" INTEGER,
    "referenceVelocityFps" DOUBLE PRECISION,
    "measuredVelocityFps" DOUBLE PRECISION,
    "conditionsJson" TEXT,
    "status" "PressureModelStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressureValidationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PressureModelVersion_workspaceId_idx" ON "PressureModelVersion"("workspaceId");

-- CreateIndex
CREATE INDEX "PressureValidationRecord_workspaceId_status_idx" ON "PressureValidationRecord"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PressureValidationRecord_loadId_idx" ON "PressureValidationRecord"("loadId");

-- AddForeignKey
ALTER TABLE "PressureModelVersion" ADD CONSTRAINT "PressureModelVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureValidationRecord" ADD CONSTRAINT "PressureValidationRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureValidationRecord" ADD CONSTRAINT "PressureValidationRecord_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureValidationRecord" ADD CONSTRAINT "PressureValidationRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureValidationRecord" ADD CONSTRAINT "PressureValidationRecord_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "PressureModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
