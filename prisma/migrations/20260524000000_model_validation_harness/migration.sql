-- Model validation harness — admin-only, governance-first.
--
-- Additive migration. Adds three new tables and three new enums for the
-- internal ballistics model adapter validation harness. NOTHING in this
-- migration changes existing tables, removes columns, or alters defaults.
--
-- Safety: every ModelValidationRun row defaults pressurePredictionStatus
-- to 'disabled', persisted so the audit trail proves no run produced a
-- pressure estimate. Case rows can carry a reference pressure value from a
-- licensed source or a lab measurement — that field is admin-only metadata
-- and is never rendered as load guidance.

-- CreateEnum: ModelValidationDatasetKind.
CREATE TYPE "ModelValidationDatasetKind" AS ENUM (
  'PUBLISHED',
  'MANUFACTURER',
  'LAB',
  'INTERNAL_TEST'
);

-- CreateEnum: ModelValidationDatasetStatus.
CREATE TYPE "ModelValidationDatasetStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'APPROVED_PENDING_REVIEW',
  'ARCHIVED'
);

-- CreateEnum: ModelValidationRunStatus.
CREATE TYPE "ModelValidationRunStatus" AS ENUM (
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED_NON_OPERATIONAL',
  'REJECTED_BY_GUARDRAIL',
  'ERRORED',
  'ARCHIVED'
);

-- CreateTable: ModelValidationDataset.
CREATE TABLE "ModelValidationDataset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "ModelValidationDatasetKind" NOT NULL DEFAULT 'PUBLISHED',
  "description" TEXT,
  "referenceIdentifier" TEXT,
  "licenseNote" TEXT,
  "status" "ModelValidationDatasetStatus" NOT NULL DEFAULT 'DRAFT',
  "acknowledgedValidationOnly" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ModelValidationDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ModelValidationCase.
CREATE TABLE "ModelValidationCase" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "cartridgeName" TEXT,
  "bulletWeightGr" DOUBLE PRECISION,
  "bulletDiameterIn" DOUBLE PRECISION,
  "chargeGr" DOUBLE PRECISION,
  "caseCapacityGrH2O" DOUBLE PRECISION,
  "barrelLengthIn" DOUBLE PRECISION,
  "twistRate" TEXT,
  "cartridgeOalIn" DOUBLE PRECISION,
  "powderBurnRateLabel" TEXT,
  "tempF" DOUBLE PRECISION,
  "referenceVelocityFps" DOUBLE PRECISION,
  -- Admin-only validation reference field. NEVER rendered as load guidance.
  "referencePressurePsi" INTEGER,
  "observedVelocityFps" DOUBLE PRECISION,
  "pageLabel" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ModelValidationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ModelValidationRun.
CREATE TABLE "ModelValidationRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "adapterName" TEXT NOT NULL,
  "adapterVersion" TEXT,
  "modelVersionId" TEXT,
  "status" "ModelValidationRunStatus" NOT NULL DEFAULT 'DRAFT',
  "pressurePredictionStatus" TEXT NOT NULL DEFAULT 'disabled',
  "summaryJson" TEXT,
  "caseResultsJson" TEXT,
  "rejectedForbiddenKeysJson" TEXT,
  "notes" TEXT,
  "acknowledgedValidationOnly" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ModelValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex.
CREATE INDEX "ModelValidationDataset_workspaceId_status_idx" ON "ModelValidationDataset"("workspaceId", "status");
CREATE INDEX "ModelValidationCase_workspaceId_idx" ON "ModelValidationCase"("workspaceId");
CREATE INDEX "ModelValidationCase_datasetId_idx" ON "ModelValidationCase"("datasetId");
CREATE INDEX "ModelValidationRun_workspaceId_status_idx" ON "ModelValidationRun"("workspaceId", "status");
CREATE INDEX "ModelValidationRun_datasetId_idx" ON "ModelValidationRun"("datasetId");

-- AddForeignKey.
ALTER TABLE "ModelValidationDataset" ADD CONSTRAINT "ModelValidationDataset_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelValidationCase" ADD CONSTRAINT "ModelValidationCase_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelValidationCase" ADD CONSTRAINT "ModelValidationCase_datasetId_fkey"
  FOREIGN KEY ("datasetId") REFERENCES "ModelValidationDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelValidationRun" ADD CONSTRAINT "ModelValidationRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelValidationRun" ADD CONSTRAINT "ModelValidationRun_datasetId_fkey"
  FOREIGN KEY ("datasetId") REFERENCES "ModelValidationDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
