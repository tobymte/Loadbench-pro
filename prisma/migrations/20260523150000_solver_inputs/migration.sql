-- Solver-input data capture (EXPERIMENTAL).
-- User-entered measurements and metadata that a future, expert-validated
-- internal-ballistics solver would need as inputs. Nothing in this app
-- computes pressure, recommends charges, or makes safe/unsafe claims from
-- these rows. The fields are stores, not formulas.

-- CreateTable
CREATE TABLE "CaseCapacityMeasurement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cartridgeId" TEXT,
    "loadId" TEXT,
    "brassComponentId" TEXT,
    "lotNumber" TEXT,
    "method" TEXT,
    "firedOrResized" TEXT,
    "waterCapacityGr" DOUBLE PRECISION,
    "sampleCount" INTEGER,
    "avgCapacityGr" DOUBLE PRECISION,
    "sdCapacityGr" DOUBLE PRECISION,
    "tempF" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseCapacityMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulletDimensionRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "componentId" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "lotNumber" TEXT,
    "weightGr" DOUBLE PRECISION,
    "diameterIn" DOUBLE PRECISION,
    "lengthIn" DOUBLE PRECISION,
    "bearingSurfaceIn" DOUBLE PRECISION,
    "boatTailLengthIn" DOUBLE PRECISION,
    "ogiveStyle" TEXT,
    "bcG1" DOUBLE PRECISION,
    "bcG7" DOUBLE PRECISION,
    "sampleCount" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletDimensionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowderMetadataRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "componentId" TEXT,
    "manufacturer" TEXT,
    "powderName" TEXT,
    "lotNumber" TEXT,
    "burnRateLabel" TEXT,
    "densityGcc" DOUBLE PRECISION,
    "bulkDensityGrPerCc" DOUBLE PRECISION,
    "kernelShape" TEXT,
    "tempSensitivityNotes" TEXT,
    "sourceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PowderMetadataRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarrelGeometryRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "rifleId" TEXT,
    "name" TEXT,
    "barrelLengthIn" DOUBLE PRECISION,
    "twistRate" TEXT,
    "boreDiameterIn" DOUBLE PRECISION,
    "grooveDiameterIn" DOUBLE PRECISION,
    "chamberNotes" TEXT,
    "throatLengthIn" DOUBLE PRECISION,
    "freeboreIn" DOUBLE PRECISION,
    "landCount" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarrelGeometryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronoCalibrationRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "serialNumber" TEXT,
    "firmwareVersion" TEXT,
    "calibrationDate" TIMESTAMP(3),
    "referenceLoadId" TEXT,
    "referenceVelocityFps" DOUBLE PRECISION,
    "observedVelocityFps" DOUBLE PRECISION,
    "offsetFps" DOUBLE PRECISION,
    "conditionsJson" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChronoCalibrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseCapacityMeasurement_workspaceId_idx" ON "CaseCapacityMeasurement"("workspaceId");
CREATE INDEX "CaseCapacityMeasurement_cartridgeId_idx" ON "CaseCapacityMeasurement"("cartridgeId");
CREATE INDEX "CaseCapacityMeasurement_loadId_idx" ON "CaseCapacityMeasurement"("loadId");

-- CreateIndex
CREATE INDEX "BulletDimensionRecord_workspaceId_idx" ON "BulletDimensionRecord"("workspaceId");
CREATE INDEX "BulletDimensionRecord_componentId_idx" ON "BulletDimensionRecord"("componentId");

-- CreateIndex
CREATE INDEX "PowderMetadataRecord_workspaceId_idx" ON "PowderMetadataRecord"("workspaceId");
CREATE INDEX "PowderMetadataRecord_componentId_idx" ON "PowderMetadataRecord"("componentId");

-- CreateIndex
CREATE INDEX "BarrelGeometryRecord_workspaceId_idx" ON "BarrelGeometryRecord"("workspaceId");
CREATE INDEX "BarrelGeometryRecord_rifleId_idx" ON "BarrelGeometryRecord"("rifleId");

-- CreateIndex
CREATE INDEX "ChronoCalibrationRecord_workspaceId_idx" ON "ChronoCalibrationRecord"("workspaceId");

-- AddForeignKey
ALTER TABLE "CaseCapacityMeasurement" ADD CONSTRAINT "CaseCapacityMeasurement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseCapacityMeasurement" ADD CONSTRAINT "CaseCapacityMeasurement_cartridgeId_fkey" FOREIGN KEY ("cartridgeId") REFERENCES "Cartridge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseCapacityMeasurement" ADD CONSTRAINT "CaseCapacityMeasurement_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseCapacityMeasurement" ADD CONSTRAINT "CaseCapacityMeasurement_brassComponentId_fkey" FOREIGN KEY ("brassComponentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletDimensionRecord" ADD CONSTRAINT "BulletDimensionRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BulletDimensionRecord" ADD CONSTRAINT "BulletDimensionRecord_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PowderMetadataRecord" ADD CONSTRAINT "PowderMetadataRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PowderMetadataRecord" ADD CONSTRAINT "PowderMetadataRecord_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PowderMetadataRecord" ADD CONSTRAINT "PowderMetadataRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarrelGeometryRecord" ADD CONSTRAINT "BarrelGeometryRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarrelGeometryRecord" ADD CONSTRAINT "BarrelGeometryRecord_rifleId_fkey" FOREIGN KEY ("rifleId") REFERENCES "Rifle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronoCalibrationRecord" ADD CONSTRAINT "ChronoCalibrationRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChronoCalibrationRecord" ADD CONSTRAINT "ChronoCalibrationRecord_referenceLoadId_fkey" FOREIGN KEY ("referenceLoadId") REFERENCES "Load"("id") ON DELETE SET NULL ON UPDATE CASCADE;
