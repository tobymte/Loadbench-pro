/**
 * Validation schemas for solver-input data capture.
 *
 * These schemas only guard structured storage of user-entered measurements
 * and metadata. They do NOT compute pressure, recommend a charge, or make
 * any safe/unsafe claim. Bounds are sanity checks (rejecting nonsense),
 * not safety thresholds.
 */

import { z } from 'zod';

const optString = (max: number) => z.string().max(max).optional().nullable();
const optFloat = (min: number, max: number) =>
  z.number().min(min).max(max).optional().nullable();
const optInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).optional().nullable();
const optId = () => z.string().min(1).max(64).optional().nullable();

export const caseCapacityMeasurementInputSchema = z.object({
  cartridgeId: optId(),
  loadId: optId(),
  brassComponentId: optId(),
  lotNumber: optString(120),
  method: optString(120),
  firedOrResized: optString(40),
  waterCapacityGr: optFloat(0, 2000),
  sampleCount: optInt(0, 100000),
  avgCapacityGr: optFloat(0, 2000),
  sdCapacityGr: optFloat(0, 2000),
  tempF: optFloat(-100, 250),
  notes: optString(4000),
});
export type CaseCapacityMeasurementInput = z.infer<
  typeof caseCapacityMeasurementInputSchema
>;

export const bulletDimensionRecordInputSchema = z.object({
  componentId: optId(),
  manufacturer: optString(120),
  model: optString(120),
  lotNumber: optString(120),
  weightGr: optFloat(0, 2000),
  diameterIn: optFloat(0, 5),
  lengthIn: optFloat(0, 10),
  bearingSurfaceIn: optFloat(0, 10),
  boatTailLengthIn: optFloat(0, 5),
  ogiveStyle: optString(120),
  bcG1: optFloat(0, 5),
  bcG7: optFloat(0, 5),
  sampleCount: optInt(0, 100000),
  notes: optString(4000),
});
export type BulletDimensionRecordInput = z.infer<
  typeof bulletDimensionRecordInputSchema
>;

export const powderMetadataRecordInputSchema = z.object({
  componentId: optId(),
  manufacturer: optString(120),
  powderName: optString(120),
  lotNumber: optString(120),
  burnRateLabel: optString(120),
  densityGcc: optFloat(0, 10),
  bulkDensityGrPerCc: optFloat(0, 200),
  kernelShape: optString(120),
  tempSensitivityNotes: optString(4000),
  sourceId: optId(),
  notes: optString(4000),
});
export type PowderMetadataRecordInput = z.infer<
  typeof powderMetadataRecordInputSchema
>;

export const barrelGeometryRecordInputSchema = z.object({
  rifleId: optId(),
  name: optString(120),
  barrelLengthIn: optFloat(0, 60),
  twistRate: optString(40),
  boreDiameterIn: optFloat(0, 5),
  grooveDiameterIn: optFloat(0, 5),
  chamberNotes: optString(4000),
  throatLengthIn: optFloat(0, 10),
  freeboreIn: optFloat(0, 5),
  landCount: optInt(0, 32),
  notes: optString(4000),
});
export type BarrelGeometryRecordInput = z.infer<
  typeof barrelGeometryRecordInputSchema
>;

export const chronoCalibrationRecordInputSchema = z.object({
  deviceName: optString(120),
  deviceType: optString(120),
  serialNumber: optString(120),
  firmwareVersion: optString(120),
  calibrationDate: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .nullable()
    .refine((v) => v == null || !Number.isNaN(Date.parse(v)), {
      message: 'calibrationDate must be a valid ISO date string',
    }),
  referenceLoadId: optId(),
  referenceVelocityFps: optFloat(0, 10000),
  observedVelocityFps: optFloat(0, 10000),
  offsetFps: optFloat(-10000, 10000),
  conditionsJson: optString(8000),
  notes: optString(4000),
});
export type ChronoCalibrationRecordInput = z.infer<
  typeof chronoCalibrationRecordInputSchema
>;

export const SOLVER_INPUT_NOT_PREDICTIVE_NOTICE =
  'Solver inputs are measurements and metadata for future validation. They do not produce pressure estimates or load advice.';
