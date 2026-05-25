// Shooters World / CIP Reference Center — shared validation helpers.
//
// Safety boundary: this module validates the *metadata* fields of a CIP /
// Shooters World published reference row. It does NOT validate handloads,
// compute pressure, or recommend charges. Pmax / MAP values are reference
// metadata transcribed from the published source and stored alongside the
// source citation. The application never converts these values into a
// per-handload prediction.

import { z } from 'zod';

export const CIP_VERIFICATION_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'VERIFIED',
  'RETIRED',
] as const;

export type CipVerificationStatus = (typeof CIP_VERIFICATION_STATUSES)[number];

export const CIP_PRESSURE_UNITS = ['BAR', 'MPA', 'PSI'] as const;
export type CipPressureUnit = (typeof CIP_PRESSURE_UNITS)[number];

export const CIP_VOLUME_UNITS = ['CM3', 'ML', 'GRAIN_H2O'] as const;
export type CipVolumeUnit = (typeof CIP_VOLUME_UNITS)[number];

// Internal canonical field names — the on-disk shape of CipReferenceRecord.
// Still accepted as CSV headers (case-insensitive, spaces/underscores ignored)
// for back-compat with previously distributed templates.
export const CIP_TEMPLATE_HEADERS = [
  'cartridgeName',
  'cartridgeCaliberLabel',
  'powderManufacturer',
  'powderFamily',
  'powderName',
  'sourceUrl',
  'sourceLabel',
  'sourceRevision',
  'sourceDate',
  'pmaxValue',
  'pmaxUnit',
  'referenceChamberVolume',
  'referenceCombustionVolume',
  'volumeUnit',
  'riflingF',
  'riflingZ',
  'riflingG',
  'notes',
] as const;

// Operator-facing header row distributed in the downloadable CSV template.
// These match the column labels published in Shooters World / CIP reference
// tables. The bulk-import parser folds the columns onto CipReferenceRecord
// fields (see lib/validation/cipBulkCsv.ts):
//   Cartridge      -> cartridgeName
//   POWDER         -> powderName
//   MAX PSI        -> pmaxValue (with implicit pmaxUnit=PSI)
//   CASE, Bullet weight, PROJECTILE, COAL, ST LOAD, ST VEL, MAX LOAD, MAX VEL
//                  -> preserved as a structured suffix on `notes`
// These columns are reference metadata only. The app never converts them
// into a per-handload chamber-pressure estimate, a charge recommendation,
// a safe/unsafe verdict, or a powder substitution.
export const CIP_TEMPLATE_CSV_HEADERS = [
  'Cartridge',
  'CASE',
  'Bullet weight',
  'PROJECTILE',
  'COAL',
  'POWDER',
  'ST LOAD',
  'ST VEL',
  'MAX LOAD',
  'MAX VEL',
  'MAX PSI',
] as const;

// Human-readable mapping from the operator-facing CSV column onto the
// CipReferenceRecord field (or `notes` suffix) the parser will produce.
// Surfaced in the admin page so reviewers can audit the mapping without
// digging into the parser source.
export const CIP_TEMPLATE_CSV_HEADER_MAPPING: ReadonlyArray<{
  header: (typeof CIP_TEMPLATE_CSV_HEADERS)[number];
  required: boolean;
  mapsTo: string;
  notes: string;
}> = [
  {
    header: 'Cartridge',
    required: true,
    mapsTo: 'cartridgeName',
    notes: 'Cartridge label exactly as printed on the source row.',
  },
  {
    header: 'CASE',
    required: false,
    mapsTo: 'notes (CASE=…)',
    notes: 'Preserved as a structured suffix on notes; no schema migration.',
  },
  {
    header: 'Bullet weight',
    required: false,
    mapsTo: 'notes (Bullet weight=…)',
    notes: 'Reference metadata; no load guidance derived.',
  },
  {
    header: 'PROJECTILE',
    required: false,
    mapsTo: 'notes (Projectile=…)',
    notes: 'Projectile description copied verbatim.',
  },
  {
    header: 'COAL',
    required: false,
    mapsTo: 'notes (COAL=…)',
    notes:
      'Published cartridge overall length. Reference only — never used as a handload spec.',
  },
  {
    header: 'POWDER',
    required: false,
    mapsTo: 'powderName',
    notes: 'Powder label as printed (no substitutions are computed).',
  },
  {
    header: 'ST LOAD',
    required: false,
    mapsTo: 'notes (ST load=…)',
    notes:
      'Starting-load label from the published table. Reference metadata — not a charge recommendation.',
  },
  {
    header: 'ST VEL',
    required: false,
    mapsTo: 'notes (ST vel=…)',
    notes: 'Starting-load velocity label. Reference metadata only.',
  },
  {
    header: 'MAX LOAD',
    required: false,
    mapsTo: 'notes (Max load=…)',
    notes:
      'Maximum-load label from the published table. Reference metadata — not a charge recommendation.',
  },
  {
    header: 'MAX VEL',
    required: false,
    mapsTo: 'notes (Max vel=…)',
    notes: 'Maximum-load velocity label. Reference metadata only.',
  },
  {
    header: 'MAX PSI',
    required: false,
    mapsTo: 'pmaxValue (pmaxUnit=PSI)',
    notes:
      'Published maximum-average pressure in PSI. Stored as admin reference metadata only; never a per-handload prediction. Leave blank if not published.',
  },
];

export const CIP_TEMPLATE_EXAMPLE_ROWS: ReadonlyArray<
  ReadonlyArray<string>
> = [
  [
    '6.5 Creedmoor', // Cartridge
    '6.5x48', // CASE
    '140 gr', // Bullet weight
    'PLACEHOLDER — transcribe from source', // PROJECTILE
    '2.825', // COAL (in)
    'PLACEHOLDER — transcribe from source', // POWDER
    '38.0', // ST LOAD (gr)
    '2650', // ST VEL (fps)
    '42.0', // MAX LOAD (gr)
    '2820', // MAX VEL (fps)
    '62000', // MAX PSI
  ],
];

export function buildCipTemplateCsv(): string {
  const rows: ReadonlyArray<ReadonlyArray<string>> = [
    CIP_TEMPLATE_CSV_HEADERS,
    ...CIP_TEMPLATE_EXAMPLE_ROWS,
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

function csvCell(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'sourceUrl must be a valid http(s) URL.' },
  )
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalFloat = z.preprocess(
  (v) => {
    if (v === '' || v == null) return undefined;
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  },
  z.number().finite().optional(),
);

const optionalDate = z.preprocess(
  (v) => {
    if (v === '' || v == null) return undefined;
    if (v instanceof Date) return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? new Date(t) : undefined;
    }
    return undefined;
  },
  z.date().optional(),
);

export const cipRecordCreateSchema = z.object({
  cartridgeName: z.string().trim().min(1).max(200),
  cartridgeCaliberLabel: optionalString,
  powderManufacturer: optionalString,
  powderFamily: optionalString,
  powderName: optionalString,
  sourceUrl: optionalUrl,
  sourceLabel: optionalString,
  sourceRevision: optionalString,
  sourceDate: optionalDate,
  pmaxValue: optionalFloat,
  pmaxUnit: z.enum(CIP_PRESSURE_UNITS).optional(),
  referenceChamberVolume: optionalFloat,
  referenceCombustionVolume: optionalFloat,
  volumeUnit: z.enum(CIP_VOLUME_UNITS).optional(),
  riflingF: optionalFloat,
  riflingZ: optionalFloat,
  riflingG: optionalFloat,
  notes: optionalString,
});

export type CipRecordCreateInput = z.infer<typeof cipRecordCreateSchema>;

// PATCH-style update schema for admins editing a draft row before
// verification. Every field is optional — only the keys explicitly provided
// are updated. cartridgeName, if provided, must still be non-empty (it is the
// only required column on the row).
export const cipRecordUpdateSchema = z.object({
  cartridgeName: z.string().trim().min(1).max(200).optional(),
  cartridgeCaliberLabel: optionalString,
  powderManufacturer: optionalString,
  powderFamily: optionalString,
  powderName: optionalString,
  sourceUrl: optionalUrl,
  sourceLabel: optionalString,
  sourceRevision: optionalString,
  sourceDate: optionalDate,
  pmaxValue: optionalFloat,
  pmaxUnit: z.enum(CIP_PRESSURE_UNITS).optional(),
  referenceChamberVolume: optionalFloat,
  referenceCombustionVolume: optionalFloat,
  volumeUnit: z.enum(CIP_VOLUME_UNITS).optional(),
  riflingF: optionalFloat,
  riflingZ: optionalFloat,
  riflingG: optionalFloat,
  notes: optionalString,
});

export type CipRecordUpdateInput = z.infer<typeof cipRecordUpdateSchema>;

// Allow-list of keys an admin PATCH may legitimately touch on the
// CipReferenceRecord row. Used in conjunction with findForbiddenKeys so we
// reject both pressure-prediction keys (defence-in-depth against the safety
// boundary) and any unrelated/internal fields (workspaceId, verifiedAt,
// verifiedByEmail, verificationStatus, createdAt, …).
export const CIP_RECORD_UPDATABLE_KEYS = [
  'cartridgeName',
  'cartridgeCaliberLabel',
  'powderManufacturer',
  'powderFamily',
  'powderName',
  'sourceUrl',
  'sourceLabel',
  'sourceRevision',
  'sourceDate',
  'pmaxValue',
  'pmaxUnit',
  'referenceChamberVolume',
  'referenceCombustionVolume',
  'volumeUnit',
  'riflingF',
  'riflingZ',
  'riflingG',
  'notes',
] as const;

// The verify action only takes the row id and an acknowledgement. We never
// auto-verify on create.
export const cipRecordVerifySchema = z.object({
  recordId: z.string().min(1),
  acknowledgedVerifiedAgainstSource: z.literal(true, {
    errorMap: () => ({
      message:
        'You must confirm you have compared this row against the published source before promoting it to VERIFIED.',
    }),
  }),
});

// Required fields a row must have populated before it can be promoted to
// VERIFIED. Surfaced to the UI so the inline editor can flag missing fields
// before the admin hits the verify button. Keep in sync with the validation
// in verifyCipRecord() — currently only sourceUrl is hard-required by the DB
// helper, but admins should be nudged to also fill cartridgeName and at
// least one source-citation field.
export const CIP_VERIFY_REQUIRED_FIELDS = ['sourceUrl', 'cartridgeName'] as const;

// Pressure unit display helpers — pure formatting, no conversion to PSI for
// safety-prediction purposes. We surface what was published.
export function formatPmax(
  value: number | null | undefined,
  unit: CipPressureUnit | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (!unit) return String(value);
  switch (unit) {
    case 'BAR':
      return `${value.toLocaleString()} bar`;
    case 'MPA':
      return `${value.toLocaleString()} MPa`;
    case 'PSI':
      return `${value.toLocaleString()} psi`;
  }
}

export function formatVolume(
  value: number | null | undefined,
  unit: CipVolumeUnit | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (!unit) return String(value);
  switch (unit) {
    case 'CM3':
      return `${value} cm³`;
    case 'ML':
      return `${value} mL`;
    case 'GRAIN_H2O':
      return `${value} gr H₂O`;
  }
}

// Friendly status badge tone mapping for the UI.
export function statusBadgeTone(
  status: CipVerificationStatus,
): 'accent' | 'warning' | 'success' | 'neutral' {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'PENDING_REVIEW':
      return 'warning';
    case 'DRAFT':
      return 'accent';
    case 'RETIRED':
      return 'neutral';
  }
}

// Safety boundary string surfaced wherever a comparison panel or admin form
// is rendered. Keep this in one place so reviewers can audit it.
export const CIP_SAFETY_BOUNDARY_MESSAGE =
  'Reference metadata only. The app does not compute per-handload chamber ' +
  'pressure, recommend charges, advise increases or decreases, or issue ' +
  'safe / unsafe verdicts. Pmax / MAP values are transcribed from the ' +
  'published CIP / Shooters World source — always verify against the ' +
  'cited source before relying on them.';

export const CIP_PRESSURE_PREDICTION_STATUS = 'disabled' as const;
