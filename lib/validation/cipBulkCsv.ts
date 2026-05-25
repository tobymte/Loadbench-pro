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

// Friendly aliases. Keys are normalized (lowercase, alphanumeric only).
const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  cartridgeName: ['cartridge', 'cartridgename', 'cartridgelabel'],
  cartridgeCaliberLabel: ['caliber', 'caliberlabel', 'cartridgecaliber', 'cartridgecaliberlabel'],
  powderManufacturer: ['powdermanufacturer', 'manufacturer', 'powderbrand'],
  powderFamily: ['powderfamily', 'family'],
  powderName: ['powder', 'powdername'],
  sourceUrl: ['sourceurl', 'url', 'source'],
  sourceLabel: ['sourcelabel', 'sourcetitle', 'sourcename'],
  sourceRevision: ['sourcerevision', 'revision', 'rev'],
  sourceDate: ['sourcedate', 'date', 'publishdate', 'published'],
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
};

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function canonFor(header: string): CanonicalField | null {
  const k = normalizeKey(header);
  // Direct canonical match first.
  for (const canon of CANONICAL_FIELDS) {
    if (normalizeKey(canon) === k) return canon;
  }
  for (const canon of CANONICAL_FIELDS) {
    if (HEADER_ALIASES[canon].includes(k)) return canon;
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

  const order: (CanonicalField | null)[] = firstCells.map((c) => canonFor(c));
  if (!order.includes('cartridgeName')) {
    return {
      headerDetected: true,
      rows: [],
      fatalError:
        'Header is missing the required "cartridgeName" column. Download the template at /api/admin/cip-reference/template.',
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

    order.forEach((canon, i) => {
      if (canon === null) return;
      const raw = cells[i] ?? '';
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
      }
    });

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
