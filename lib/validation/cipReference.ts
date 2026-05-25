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

// Headers and example rows for the downloadable CSV template. Synthetic
// example only — no live data scraped from cip-bob.org. Operators must
// transcribe each row themselves and verify against the published source.
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

export const CIP_TEMPLATE_EXAMPLE_ROWS: ReadonlyArray<
  ReadonlyArray<string>
> = [
  [
    '6.5 Creedmoor',
    '6.5x48',
    'Shooters World',
    'Precision Rifle',
    'PLACEHOLDER — transcribe from CIP TDCC',
    'https://cip-bob.org/tdcc/<cartridge>.pdf',
    'CIP TDCC <cartridge> (synthetic example)',
    'rev 1',
    '2024-01-15',
    '4350',
    'BAR',
    '3.65',
    '3.30',
    'CM3',
    '0.20',
    '0.50',
    '0.15',
    'Synthetic example — replace with values transcribed from the CIP source.',
  ],
];

export function buildCipTemplateCsv(): string {
  const rows: ReadonlyArray<ReadonlyArray<string>> = [
    CIP_TEMPLATE_HEADERS,
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
