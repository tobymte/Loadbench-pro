-- Published-data review/staging (NON-AUTHORITATIVE).
-- PublishedDataImport and PublishedLoadRowDraft hold rows transcribed from
-- manufacturer/published references for the user to verify against the
-- original document before any downstream use as a citation on a Load.
-- Rows here are NOT loads, are NOT recommendations, and are NOT presented
-- as safe/unsafe.

-- CreateEnum
CREATE TYPE "PublishedDataImportStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublishedLoadRowStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "PublishedDataImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "status" "PublishedDataImportStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedDataImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishedDataImport_workspaceId_status_idx" ON "PublishedDataImport"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "PublishedDataImport" ADD CONSTRAINT "PublishedDataImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedDataImport" ADD CONSTRAINT "PublishedDataImport_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PublishedLoadRowDraft" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sourceId" TEXT,
    "cartridgeId" TEXT,
    "bulletComponentId" TEXT,
    "powderComponentId" TEXT,
    "pageLabel" TEXT,
    "bulletWeightGr" DOUBLE PRECISION,
    "bulletName" TEXT,
    "powderName" TEXT,
    "chargeGr" DOUBLE PRECISION,
    "velocityFps" DOUBLE PRECISION,
    "isMaxLoad" BOOLEAN NOT NULL DEFAULT false,
    "colIn" DOUBLE PRECISION,
    "bcG1" DOUBLE PRECISION,
    "bcG7" DOUBLE PRECISION,
    "status" "PublishedLoadRowStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "sourceExcerptHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedLoadRowDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishedLoadRowDraft_workspaceId_status_idx" ON "PublishedLoadRowDraft"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PublishedLoadRowDraft_importId_idx" ON "PublishedLoadRowDraft"("importId");

-- AddForeignKey
ALTER TABLE "PublishedLoadRowDraft" ADD CONSTRAINT "PublishedLoadRowDraft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedLoadRowDraft" ADD CONSTRAINT "PublishedLoadRowDraft_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PublishedDataImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedLoadRowDraft" ADD CONSTRAINT "PublishedLoadRowDraft_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
