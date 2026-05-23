-- Simulation sandbox (NON-OPERATIONAL).
-- SimulationRun records the outcome of comparing a user-entered reference
-- (or chrono session) against a placeholder PressureModelVersion. It stores
-- review status and velocity-delta bookkeeping only. Nothing in this app
-- computes pressure predictions, recommends charges, or labels any load as
-- safe or unsafe.

-- CreateEnum
CREATE TYPE "SimulationRunStatus" AS ENUM ('DRAFT', 'INPUT_INCOMPLETE', 'READY_FOR_EXPERT_REVIEW', 'REFERENCE_MATCHED_WITHIN_TOLERANCE', 'NEEDS_INVESTIGATION', 'REJECTED_BY_REVIEWER');

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "loadId" TEXT,
    "validationRecordId" TEXT,
    "rangeSessionId" TEXT,
    "status" "SimulationRunStatus" NOT NULL DEFAULT 'DRAFT',
    "velocityDeltaFps" DOUBLE PRECISION,
    "velocityDeltaPct" DOUBLE PRECISION,
    "toleranceFps" DOUBLE PRECISION,
    "tolerancePct" DOUBLE PRECISION,
    "notes" TEXT,
    "reviewerNotes" TEXT,
    "acknowledgedExperimental" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationRun_workspaceId_status_idx" ON "SimulationRun"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "SimulationRun_modelVersionId_idx" ON "SimulationRun"("modelVersionId");

-- CreateIndex
CREATE INDEX "SimulationRun_loadId_idx" ON "SimulationRun"("loadId");

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "PressureModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_validationRecordId_fkey" FOREIGN KEY ("validationRecordId") REFERENCES "PressureValidationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_rangeSessionId_fkey" FOREIGN KEY ("rangeSessionId") REFERENCES "RangeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
