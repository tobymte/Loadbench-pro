-- Add inventory recordkeeping fields to Component. These are user-entered
-- estimates only; LoadBench Pro does not infer or recommend physical stock
-- levels from these values.
ALTER TABLE "Component" ADD COLUMN "quantityOnHand" DOUBLE PRECISION;
ALTER TABLE "Component" ADD COLUMN "unit" TEXT;
ALTER TABLE "Component" ADD COLUMN "lowStockThreshold" DOUBLE PRECISION;
