// Bulk CSV parser for the Shooters World / CIP Reference Center.
//
// SAFETY BOUNDARY (do not remove):
//   This module parses *metadata* rows transcribed from published CIP /
//   Shooters World sources. It does NOT compute, predict, or recommend
//   chamber pressure, charges, increases / decreases, or safe / unsafe
//   verdicts. Rows produced by this parser are always staged as DRAFT —
//   never auto-verified — and the caller must reject any forbidden output
//   key (predictedPressurePsi, recommendedCharge, etc.) before persistence.
//
// What this returns:
//   - Per-row parsed values mapped to CipReferenceRecord fields
//   - Per-row errors (blocks save) and warnings (does not block)
//   - Header detection with friendly uppercase / spaced alias support
//
// What this deliberately does NOT do:
//   - Look up workspace components, infer pressure, or convert units
//   - Fetch external sources or follow redirects
//   - Auto-verify or change verification status

import {
  CIP_PRESSURE_UNITS,
  CIP_VOLUME_UNITS,
  CIP_TEMPLATE_HEADERS,
  type CipPressureUnit,
  type CipVolumeUnit,
} from '@/lib/validation/cipReference';
import { CIP_KNOWN_HOSTS } from '@/lib/validation/cipSourceFetch';

export type CipBulkRowValues = {
  cartridgeName: string | null;
  cartridgeCaliberLabel: string | null;
  powderManufacturer: string | null;
  powderFamily: string | null;
  powderName: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  sourceRevision: string | null;
  sourceDate: string | null; // ISO yyyy-mm-dd or null
  pmaxValue: number | null;
  pmaxUnit: CipPressureUnit | null;
  referenceChamberVolume: number | null;
  referenceCombustionVolume: number | null;
  volumeUnit: CipVolumeUnit | null;
  riflingF: number | null;
  riflingZ: number | null;
  riflingG: number | null;
  notes: string | null;
};

export type CipBulkRowIssue = {
  field?: keyof CipBulkRowValues;
  message: string;
};

export type CipBulkRow = {
  rowNumber: number; // 1-based, excluding header
  raw: string;
  values: CipBulkRowValues;
  errors: CipBulkRowIssue[];
  warnings: CipBulkRowIssue[];
};

export type CipBulkParseResult = {
  headerDetected: boolean;
  rows: CipBulkRow[];
  fatalError: string | null;
};

const CANONICAL_FIELDS = CIP_TEMPLATE_HEADERS;
type CanonicalField = (typeof CANONICAL_FIELDS)[number];

// Operator-facing CSV columns that don't map 1:1 onto a CipReferenceRecord
// field. These are still admin-only reference metadata transcribed from the
// published source — never charge guidance, never a pressure prediction. We
// fold them into the `notes` field as a single structured suffix so no data
// is dropped, but the schema shape stays stable.
//
//   CASE         — physical case / chamber label as printed on the source row
//   Bullet weight — projectile mass label (e.g. "140 gr")
//   PROJECTILE   — projectile description
//   COAL         — published cartridge overall length (reference only)
//   ST LOAD      — "starting load" label from the published table (reference only)
//   ST VEL       — "starting velocity" label from the published table
//   MAX LOAD     — "maximum load" label from the published table (reference only)
//   MAX VEL      — "maximum velocity" label from the published table
//
// `MAX PSI` is handled separately: it maps to `pmaxValue` with an implicit
// `pmaxUnit=PSI` when no other unit was specified.
const EXTRA_NOTE_FIELDS = [
  'extraCase',
  'extraBulletWeight',
  'extraProjectile',
  'extraCoal',
  'extraStLoad',
  'extraStVel',
  'extraMaxLoad',
  'extraMaxVel',
] as const;
type ExtraNoteField = (typeof EXTRA_NOTE_FIELDS)[number];

const EXTRA_NOTE_LABELS: Record<ExtraNoteField, string> = {
  extraCase: 'CASE',
  extraBulletWeight: 'Bullet weight',
  extraProjectile: 'Projectile',
  extraCoal: 'COAL',
  extraStLoad: 'ST load',
  extraStVel: 'ST vel',
  extraMaxLoad: 'Max load',
  extraMaxVel: 'Max vel',
};

// `maxPsi` is a parser-internal canonical key. We accept the operator header
// `MAX PSI` here and feed the numeric value into `pmaxValue` (with an
// implicit `pmaxUnit=PSI` if nothing else was specified).
type ParserCanonicalField = CanonicalField | ExtraNoteField | 'maxPsi';

// Friendly aliases. Keys are normalized (lowercase, alphanumeric only).
// Operator-facing aliases (Shooters World / CIP printed-table column names)
// are listed alongside the previous canonical / friendly aliases so older
// templates continue to import.
const HEADER_ALIASES: Record<ParserCanonicalField, string[]> = {
  cartridgeName: ['cartridge', 'cartridgename', 'cartridgelabel'],
  cartridgeCaliberLabel: ['caliber', 'caliberlabel', 'cartridgecaliber', 'cartridgecaliberlabel'],
  powderManufacturer: ['powdermanufacturer', 'manufacturer', 'powderbrand'],
  powderFamily: ['powderfamily', 'family'],
  powderName: ['powder', 'powdername'],
  sourceUrl: ['sourceurl', 'url', 'source'],
  sourceLabel: ['sourcelabel', 'sourcetitle', 'sourcename'],
  sourceRevision: ['sourcerevision', 'revision', 'rev'],
  sourceDate: ['sourcedate', 'date', 'publishdate', 'published'],
  // Note: `maxpressure` stays here as a legacy alias for `pmaxValue` for
  // back-compat with older templates. The new operator header `MAX PSI`
  // is routed separately via the `maxPsi` virtual field so we can attach
  // an implicit `pmaxUnit=PSI`.
  pmaxValue: ['pmaxvalue', 'pmax', 'map', 'maxpressure'],
  pmaxUnit: ['pmaxunit', 'pressureunit', 'unit'],
  referenceChamberVolume: ['referencechambervolume', 'chambervolume', 'vchamber', 'chamberv'],
  referenceCombustionVolume: [
    'referencecombustionvolume',
    'combustionvolume',
    'vcombustion',
    'combustionv',
  ],
  volumeUnit: ['volumeunit', 'volunit', 'vunit'],
  riflingF: ['riflingf', 'f'],
  riflingZ: ['riflingz', 'z'],
  riflingG: ['riflingg', 'g'],
  notes: ['notes', 'note', 'comment', 'comments'],
  // New operator-facing reference columns. Folded into `notes` so no data
  // is dropped — these are metadata, not load guidance.
  extraCase: ['case', 'casetype', 'caselabel'],
  extraBulletWeight: ['bulletweight', 'bulletwt', 'bullet'],
  extraProjectile: ['projectile', 'proj'],
  extraCoal: ['coal', 'oal', 'cartridgeoal'],
  extraStLoad: ['stload', 'startload', 'startingload', 'startcharge'],
  extraStVel: ['stvel', 'startvel', 'startingvel', 'startvelocity'],
  extraMaxLoad: ['maxload', 'maximumload', 'maxcharge'],
  extraMaxVel: ['maxvel', 'maxvelocity'],
  // MAX PSI — published maximum-average pressure in PSI. Reference metadata
  // only; never a per-handload prediction. Operator may also omit it.
  maxPsi: ['maxpsi', 'pmaxpsi'],
};

const EXTRA_NOTE_SET = new Set<string>(EXTRA_NOTE_FIELDS);
function isExtraNoteField(c: ParserCanonicalField): c is ExtraNoteField {
  return EXTRA_NOTE_SET.has(c);
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function canonFor(header: string): ParserCanonicalField | null {
  const k = normalizeKey(header);
  // Direct canonical match first (the on-disk CipReferenceRecord field names).
  for (const canon of CANONICAL_FIELDS) {
    if (normalizeKey(canon) === k) return canon;
  }
  // Then any alias — canonical or operator-facing.
  const aliasEntries = Object.entries(HEADER_ALIASES) as [
    ParserCanonicalField,
    string[],
  ][];
  for (const [canon, aliases] of aliasEntries) {
    if (aliases.includes(k)) return canon;
  }
  return null;
}

function detectDelimiter(line: string): ',' | '\t' | ';' {
  const tabs = (line.match(/\t/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas && semis > 0) return ';';
  return ',';
}

// Minimal CSV splitter that honors double-quoted fields and embedded delim.
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseOptionalNumber(
  raw: string,
  field: keyof CipBulkRowValues,
): { value: number | null; error?: CipBulkRowIssue } {
  const s = raw.trim();
  if (s === '' || s === '-' || s === '—') return { value: null };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) {
    return {
      value: null,
      error: { field, message: `Invalid number for ${field}: "${raw}"` },
    };
  }
  return { value: n };
}

function parseOptionalUrl(
  raw: string,
): { value: string | null; error?: CipBulkRowIssue; warning?: CipBulkRowIssue } {
  const s = raw.trim();
  if (s === '') return { value: null };
  if (s.length > 500) {
    return {
      value: null,
      error: { field: 'sourceUrl', message: 'sourceUrl too long (max 500 chars).' },
    };
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return {
        value: null,
        error: { field: 'sourceUrl', message: 'sourceUrl must be http(s).' },
      };
    }
    const host = u.host.toLowerCase();
    const isKnown = CIP_KNOWN_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
    if (!isKnown) {
      return {
        value: s,
        warning: {
          field: 'sourceUrl',
          message: `Source host "${host}" is not on the known CIP allow-list (${CIP_KNOWN_HOSTS.join(', ')}). Row will still import as DRAFT.`,
        },
      };
    }
    return { value: s };
  } catch {
    return {
      value: null,
      error: { field: 'sourceUrl', message: `sourceUrl is not a valid URL: "${s}"` },
    };
  }
}

function parseOptionalDate(
  raw: string,
): { value: string | null; error?: CipBulkRowIssue } {
  const s = raw.trim();
  if (s === '') return { value: null };
  const t = Date.parse(s);
  if (!Number.isFinite(t)) {
    return {
      value: null,
      error: { field: 'sourceDate', message: `Invalid sourceDate: "${raw}"` },
    };
  }
  return { value: new Date(t).toISOString().slice(0, 10) };
}

function parseEnum<T extends string>(
  raw: string,
  field: keyof CipBulkRowValues,
  allowed: readonly T[],
): { value: T | null; error?: CipBulkRowIssue } {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (s === '') return { value: null };
  // Friendly aliases for units.
  const aliases: Record<string, string> = {
    BARS: 'BAR',
    'MEGA-PASCAL': 'MPA',
    MEGAPASCAL: 'MPA',
    'MEGA_PASCAL': 'MPA',
    'PSI': 'PSI',
    'CM^3': 'CM3',
    'CC': 'CM3',
    'CCM': 'CM3',
    'ML': 'ML',
    'GRH2O': 'GRAIN_H2O',
    GRAINH2O: 'GRAIN_H2O',
    'GRAIN-H2O': 'GRAIN_H2O',
  };
  const normalized = aliases[s] ?? s;
  if ((allowed as readonly string[]).includes(normalized)) {
    return { value: normalized as T };
  }
  return {
    value: null,
    error: {
      field,
      message: `Invalid ${field}: "${raw}". Allowed: ${allowed.join(', ')}.`,
    },
  };
}

function dedupeKey(v: CipBulkRowValues): string {
  return [
    (v.cartridgeName ?? '').toLowerCase().trim(),
    (v.powderManufacturer ?? '').toLowerCase().trim(),
    (v.powderName ?? '').toLowerCase().trim(),
    (v.sourceUrl ?? '').toLowerCase().trim(),
    v.pmaxValue == null ? '' : String(v.pmaxValue),
    v.pmaxUnit ?? '',
  ].join('|');
}

export function parseCipBulkCsv(text: string): CipBulkParseResult {
  const trimmed = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) {
    return {
      headerDetected: false,
      rows: [],
      fatalError: 'No content. Paste CSV rows or upload a file.',
    };
  }

  const rawLines = trimmed
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));

  if (rawLines.length === 0) {
    return { headerDetected: false, rows: [], fatalError: 'No content rows.' };
  }

  const delim = detectDelimiter(rawLines[0]);
  const firstCells = splitLine(rawLines[0], delim);

  // Header detection: if the first row's cells map to known canonical fields
  // (majority), treat it as a header row.
  const knownCount = firstCells.filter((c) => canonFor(c) !== null).length;
  const headerDetected =
    firstCells.length >= 2 && knownCount >= Math.ceil(firstCells.length / 2);

  if (!headerDetected) {
    return {
      headerDetected: false,
      rows: [],
      fatalError:
        'No recognizable header row. The first non-comment line must contain CSV headers — download the template at /api/admin/cip-reference/template.',
    };
  }

  const order: (ParserCanonicalField | null)[] = firstCells.map((c) =>
    canonFor(c),
  );
  if (!order.includes('cartridgeName')) {
    return {
      headerDetected: true,
      rows: [],
      fatalError:
        'Header is missing the required "Cartridge" / "cartridgeName" column. Download the template at /api/admin/cip-reference/template.',
    };
  }

  const dataLines = rawLines.slice(1);
  const seenKeys = new Map<string, number>();
  const rows: CipBulkRow[] = [];

  dataLines.forEach((line, idx) => {
    const cells = splitLine(line, delim);
    const errors: CipBulkRowIssue[] = [];
    const warnings: CipBulkRowIssue[] = [];

    const values: CipBulkRowValues = {
      cartridgeName: null,
      cartridgeCaliberLabel: null,
      powderManufacturer: null,
      powderFamily: null,
      powderName: null,
      sourceUrl: null,
      sourceLabel: null,
      sourceRevision: null,
      sourceDate: null,
      pmaxValue: null,
      pmaxUnit: null,
      referenceChamberVolume: null,
      referenceCombustionVolume: null,
      volumeUnit: null,
      riflingF: null,
      riflingZ: null,
      riflingG: null,
      notes: null,
    };

    // Operator-facing columns that don't map 1:1 onto a CipReferenceRecord
    // field — we'll fold these into `notes` after the cell loop so no data
    // is dropped silently.
    const extras: Partial<Record<ExtraNoteField, string>> = {};
    // Tracks whether the operator supplied a `MAX PSI` cell, so we can
    // attach an implicit `pmaxUnit=PSI` only when no explicit unit was set
    // by the row itself.
    let maxPsiSeen = false;

    order.forEach((canon, i) => {
      if (canon === null) return;
      const raw = cells[i] ?? '';

      if (isExtraNoteField(canon)) {
        const s = raw.trim();
        if (s !== '') extras[canon] = s.slice(0, 200);
        return;
      }

      switch (canon) {
        case 'cartridgeName':
        case 'cartridgeCaliberLabel':
        case 'powderManufacturer':
        case 'powderFamily':
        case 'powderName':
        case 'sourceLabel':
        case 'sourceRevision':
        case 'notes': {
          const s = raw.trim();
          values[canon] = s === '' ? null : s.slice(0, 500);
          break;
        }
        case 'sourceUrl': {
          const r = parseOptionalUrl(raw);
          values.sourceUrl = r.value;
          if (r.error) errors.push(r.error);
          if (r.warning) warnings.push(r.warning);
          break;
        }
        case 'sourceDate': {
          const r = parseOptionalDate(raw);
          values.sourceDate = r.value;
          if (r.error) errors.push(r.error);
          break;
        }
        case 'pmaxValue':
        case 'referenceChamberVolume':
        case 'referenceCombustionVolume':
        case 'riflingF':
        case 'riflingZ':
        case 'riflingG': {
          const r = parseOptionalNumber(raw, canon);
          values[canon] = r.value;
          if (r.error) errors.push(r.error);
          break;
        }
        case 'pmaxUnit': {
          const r = parseEnum(raw, 'pmaxUnit', CIP_PRESSURE_UNITS);
          values.pmaxUnit = r.value;
          if (r.error) errors.push(r.error);
          break;
        }
        case 'volumeUnit': {
          const r = parseEnum(raw, 'volumeUnit', CIP_VOLUME_UNITS);
          values.volumeUnit = r.value;
          if (r.error) errors.push(r.error);
          break;
        }
        case 'maxPsi': {
          // `MAX PSI` from the published Shooters World / CIP table. Treated
          // as reference metadata — not a per-handload prediction.
          if (raw.trim() === '') {
            maxPsiSeen = false;
            break;
          }
          maxPsiSeen = true;
          const r = parseOptionalNumber(raw, 'pmaxValue');
          if (r.error) {
            errors.push({ field: 'pmaxValue', message: r.error.message });
            break;
          }
          if (r.value != null) {
            if (values.pmaxValue != null && values.pmaxValue !== r.value) {
              warnings.push({
                field: 'pmaxValue',
                message: `MAX PSI (${r.value}) conflicts with pmaxValue (${values.pmaxValue}); MAX PSI used.`,
              });
            }
            values.pmaxValue = r.value;
          }
          break;
        }
      }
    });

    // If MAX PSI supplied a value and the row didn't set an explicit pmaxUnit,
    // tag the unit as PSI. This is admin/reference metadata only; the engine
    // never converts pmax into a per-handload pressure verdict.
    if (maxPsiSeen && values.pmaxValue != null && !values.pmaxUnit) {
      values.pmaxUnit = 'PSI';
    }

    // Fold extras into notes. Append in template order so reviewers see a
    // predictable layout. Existing `notes` content is preserved.
    const extraParts: string[] = [];
    for (const key of EXTRA_NOTE_FIELDS) {
      const v = extras[key];
      if (v && v.length > 0) {
        extraParts.push(`${EXTRA_NOTE_LABELS[key]}=${v}`);
      }
    }
    if (extraParts.length > 0) {
      const suffix = extraParts.join('; ');
      const base = values.notes && values.notes.length > 0 ? values.notes : '';
      const combined = base ? `${base} | ${suffix}` : suffix;
      values.notes = combined.slice(0, 500);
    }

    // Skip rows that are completely blank.
    const allBlank = cells.every((c) => c.trim() === '');
    if (allBlank) return;

    // Required field.
    if (!values.cartridgeName || values.cartridgeName.length === 0) {
      errors.push({
        field: 'cartridgeName',
        message: 'cartridgeName is required.',
      });
    }

    // Warnings.
    if (!values.sourceUrl) {
      warnings.push({
        field: 'sourceUrl',
        message:
          'Row has no sourceUrl. It will import as DRAFT but cannot be VERIFIED until a source URL is added.',
      });
    }
    if (!values.powderName && !values.powderFamily && !values.powderManufacturer) {
      warnings.push({
        field: 'powderName',
        message:
          'Row has no powder identification (powderName / powderFamily / powderManufacturer).',
      });
    }
    if (values.pmaxValue != null && !values.pmaxUnit) {
      warnings.push({
        field: 'pmaxUnit',
        message: 'pmaxValue provided without pmaxUnit; unit will be unknown.',
      });
    }
    if (
      (values.referenceChamberVolume != null ||
        values.referenceCombustionVolume != null) &&
      !values.volumeUnit
    ) {
      warnings.push({
        field: 'volumeUnit',
        message: 'volume provided without volumeUnit; unit will be unknown.',
      });
    }

    // Duplicate detection within this batch.
    if (values.cartridgeName) {
      const key = dedupeKey(values);
      const prior = seenKeys.get(key);
      if (prior !== undefined) {
        warnings.push({
          message: `Looks like a duplicate of row ${prior} in this batch.`,
        });
      } else {
        seenKeys.set(key, idx + 1);
      }
    }

    rows.push({
      rowNumber: idx + 1,
      raw: line,
      values,
      errors,
      warnings,
    });
  });

  return { headerDetected: true, rows, fatalError: null };
}

// Convert a parsed bulk row into the shape that createCipRecord expects.
// Returns null for rows with errors — callers must filter those out first.
export function bulkRowToCreateInput(values: CipBulkRowValues): {
  cartridgeName: string;
  cartridgeCaliberLabel?: string;
  powderManufacturer?: string;
  powderFamily?: string;
  powderName?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceRevision?: string;
  sourceDate?: Date;
  pmaxValue?: number;
  pmaxUnit?: CipPressureUnit;
  referenceChamberVolume?: number;
  referenceCombustionVolume?: number;
  volumeUnit?: CipVolumeUnit;
  riflingF?: number;
  riflingZ?: number;
  riflingG?: number;
  notes?: string;
} | null {
  if (!values.cartridgeName) return null;
  const out: ReturnType<typeof bulkRowToCreateInput> = {
    cartridgeName: values.cartridgeName,
  };
  if (values.cartridgeCaliberLabel)
    out!.cartridgeCaliberLabel = values.cartridgeCaliberLabel;
  if (values.powderManufacturer)
    out!.powderManufacturer = values.powderManufacturer;
  if (values.powderFamily) out!.powderFamily = values.powderFamily;
  if (values.powderName) out!.powderName = values.powderName;
  if (values.sourceUrl) out!.sourceUrl = values.sourceUrl;
  if (values.sourceLabel) out!.sourceLabel = values.sourceLabel;
  if (values.sourceRevision) out!.sourceRevision = values.sourceRevision;
  if (values.sourceDate) out!.sourceDate = new Date(values.sourceDate);
  if (values.pmaxValue != null) out!.pmaxValue = values.pmaxValue;
  if (values.pmaxUnit) out!.pmaxUnit = values.pmaxUnit;
  if (values.referenceChamberVolume != null)
    out!.referenceChamberVolume = values.referenceChamberVolume;
  if (values.referenceCombustionVolume != null)
    out!.referenceCombustionVolume = values.referenceCombustionVolume;
  if (values.volumeUnit) out!.volumeUnit = values.volumeUnit;
  if (values.riflingF != null) out!.riflingF = values.riflingF;
  if (values.riflingZ != null) out!.riflingZ = values.riflingZ;
  if (values.riflingG != null) out!.riflingG = values.riflingG;
  if (values.notes) out!.notes = values.notes;
  return out;
}
