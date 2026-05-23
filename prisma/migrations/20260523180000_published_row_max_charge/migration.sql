-- Row-specific published maximum charge for Published Data Review.
-- Many published reload tables record a per-row max (per bullet/powder pair)
-- that is finer-grained than Source.publishedMaxGr. Adds:
--   * PublishedLoadRowDraft.publishedMaxChargeGr
--   * Load.publishedMaxChargeGr (snapshot copied when a Load is created from
--     a verified row), Load.publishedDataRowId (FK back to the row), and
--     Load.sourcePageLabel (page citation for the row).
-- These fields are NEVER computed by the app. They store user-transcribed
-- values from a published reference for validation only.

-- AlterTable
ALTER TABLE "PublishedLoadRowDraft" ADD COLUMN "publishedMaxChargeGr" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Load" ADD COLUMN "publishedMaxChargeGr" DOUBLE PRECISION;
ALTER TABLE "Load" ADD COLUMN "publishedDataRowId" TEXT;
ALTER TABLE "Load" ADD COLUMN "sourcePageLabel" TEXT;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_publishedDataRowId_fkey" FOREIGN KEY ("publishedDataRowId") REFERENCES "PublishedLoadRowDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
