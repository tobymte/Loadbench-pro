-- Add rifle optics + zero distance and session group distance fields.
ALTER TABLE "Rifle" ADD COLUMN "opticNotes" TEXT;
ALTER TABLE "Rifle" ADD COLUMN "zeroDistanceYd" DOUBLE PRECISION;

ALTER TABLE "RangeSession" ADD COLUMN "groupDistanceYd" DOUBLE PRECISION;
