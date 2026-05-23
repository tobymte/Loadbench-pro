-- Simulation sandbox metrics + published-row link.
-- Adds publishedRowId FK so a SimulationRun can reference a user-verified
-- PublishedLoadRowDraft as its reference. Adds inputsSnapshotJson and
-- metricsJson columns to persist the inputs that drove the run and the
-- non-prescriptive comparison metrics that were computed at run time
-- (velocity delta, abs delta, residual, completeness, coverage label).
-- Nothing in this migration introduces a pressure prediction or charge
-- recommendation. The JSON columns are descriptive of user-entered values
-- only.

-- AlterTable
ALTER TABLE "SimulationRun"
  ADD COLUMN "publishedRowId" TEXT,
  ADD COLUMN "inputsSnapshotJson" TEXT,
  ADD COLUMN "metricsJson" TEXT;

-- CreateIndex
CREATE INDEX "SimulationRun_publishedRowId_idx" ON "SimulationRun"("publishedRowId");

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_publishedRowId_fkey" FOREIGN KEY ("publishedRowId") REFERENCES "PublishedLoadRowDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
