-- Pressure engine — non-operational shell.
--
-- Additive migration. Adds:
--   * Governance metadata columns on PressureModelVersion (all nullable).
--   * New enum PressureEngineRunStatus.
--   * New table PressureEngineRun, recording audit/history of engine runs
--     that never produce pressure predictions, charge recommendations, or
--     safe/unsafe verdicts.
--
-- Nothing in this migration removes existing Stripe / BigCommerce /
-- entitlement / pressure-modeling fields. Existing rows are preserved.
-- The engine runner enforces a forbidden-output guardrail at the API
-- layer; this DDL exists only to persist the audit shell.

-- AlterTable: governance metadata on PressureModelVersion.
ALTER TABLE "PressureModelVersion"
  ADD COLUMN "governanceStatus" TEXT,
  ADD COLUMN "blockedOutputsPolicy" TEXT,
  ADD COLUMN "validationNotes" TEXT;

-- CreateEnum: PressureEngineRunStatus.
CREATE TYPE "PressureEngineRunStatus" AS ENUM (
  'DRAFT',
  'INPUT_INCOMPLETE',
  'COMPLETED_NON_OPERATIONAL',
  'REJECTED_BY_GUARDRAIL',
  'ARCHIVED'
);

-- CreateTable: PressureEngineRun.
CREATE TABLE "PressureEngineRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "modelVersionId" TEXT,
  "loadId" TEXT,
  "rangeSessionId" TEXT,
  "validationRecordId" TEXT,
  "status" "PressureEngineRunStatus" NOT NULL DEFAULT 'DRAFT',
  "pressurePredictionStatus" TEXT NOT NULL DEFAULT 'disabled',
  "inputsSnapshotJson" TEXT,
  "outputsJson" TEXT,
  "velocityDeltaFps" DOUBLE PRECISION,
  "velocityDeltaPct" DOUBLE PRECISION,
  "notes" TEXT,
  "acknowledgedExperimental" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PressureEngineRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex.
CREATE INDEX "PressureEngineRun_workspaceId_status_idx" ON "PressureEngineRun"("workspaceId", "status");
CREATE INDEX "PressureEngineRun_modelVersionId_idx" ON "PressureEngineRun"("modelVersionId");
CREATE INDEX "PressureEngineRun_loadId_idx" ON "PressureEngineRun"("loadId");

-- AddForeignKey.
ALTER TABLE "PressureEngineRun" ADD CONSTRAINT "PressureEngineRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PressureEngineRun" ADD CONSTRAINT "PressureEngineRun_modelVersionId_fkey"
  FOREIGN KEY ("modelVersionId") REFERENCES "PressureModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PressureEngineRun" ADD CONSTRAINT "PressureEngineRun_loadId_fkey"
  FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PressureEngineRun" ADD CONSTRAINT "PressureEngineRun_rangeSessionId_fkey"
  FOREIGN KEY ("rangeSessionId") REFERENCES "RangeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PressureEngineRun" ADD CONSTRAINT "PressureEngineRun_validationRecordId_fkey"
  FOREIGN KEY ("validationRecordId") REFERENCES "PressureValidationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
