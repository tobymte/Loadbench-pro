// Parser for the Batch Published Row Entry feature on /published-data-review.
//
// Accepts CSV- or TSV-style pasted text the user transcribed from a published
// reference (manufacturer manual, reload data sheet, etc.) and returns a row
// list with per-row errors. Parsed rows are NOT recommendations and NOT
// authoritative load data — they are staged for verification against the
// original document before any downstream use.

export type ParsedBatchRow = {
  // 1-based row number within the user's pasted block (excluding header).
  rowNumber: number;
  raw: string;
  values: ParsedBatchRowValues;
  errors: ParsedBatchRowError[];
  warnings: ParsedBatchRowError[];
};

export type ParsedBatchRowValues = {
  bulletName: string | null;
  powderName: string | null;
  bulletComponentId: string | null;
  powderComponentId: string | null;
  chargeGr: number | null;
  velocityFps: number | null;
  publishedMaxChargeGr: number | null;
  isMaxLoad: boolean;
  colIn: number | null;
  pageLabel: string | null;
  notes: string | null;
};

export type ParsedBatchRowError = {
  field?: string;
  message: string;
};

export type ParseBatchResult = {
  headerDetected: boolean;
  rows: ParsedBatchRow[];
  fatalError: string | null;
};

export type ComponentOption = {
  id: string;
  manufacturer: string;
  model: string;
};

// Canonical header keys.
type Canon =
  | 'bullet'
  | 'powder'
  | 'velocity'
  | 'charge'
  | 'max'
  | 'isMax'
  | 'col'
  | 'page'
  | 'notes';

const HEADER_ALIASES: Record<Canon, string[]> = {
  bullet: ['bullet', 'bulletlabel', 'bulletname'],
  powder: ['powder', 'powderlabel', 'powdername'],
  velocity: ['velocity', 'velocityfps', 'fps'],
  charge: ['charge', 'chargegr', 'gr'],
  max: ['max', 'publishedmaxchargegr', 'rowmax', 'maxcharge'],
  isMax: ['ismax', 'ismaxload', 'maxload', 'maxflag'],
  col: ['col', 'colin', 'coal', 'coalin'],
  page: ['page', 'pagelabel'],
  notes: ['notes', 'note'],
};

// Default field order if no header is provided.
const DEFAULT_HEADER_ORDER: Canon[] = [
  'bullet',
  'powder',
  'velocity',
  'charge',
  'max',
  'isMax',
  'col',
  'page',
  'notes',
];

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function canonFor(header: string): Canon | null {
  const k = normalizeKey(header);
  for (const canon of Object.keys(HEADER_ALIASES) as Canon[]) {
    if (HEADER_ALIASES[canon].includes(k)) return canon;
  }
  return null;
}

function detectDelimiter(line: string): ',' | '\t' {
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

// Minimal CSV splitter that honors double-quoted fields and embedded commas.
// For TSV input we still call this with delimiter='\t' — quotes are
// uncommon in TSV but tolerated.
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

function parseNumber(raw: string): { value: number | null; error?: string } {
  const s = raw.trim();
  if (s === '' || s === '-' || s === '—') return { value: null };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { value: null, error: `not a number: "${raw}"` };
  if (n <= 0) return { value: null, error: `must be > 0: "${raw}"` };
  return { value: n };
}

function parseBool(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  return (
    s === 'true' ||
    s === 't' ||
    s === 'yes' ||
    s === 'y' ||
    s === '1' ||
    s === 'max'
  );
}

function isFalseLike(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  return (
    s === '' ||
    s === 'false' ||
    s === 'f' ||
    s === 'no' ||
    s === 'n' ||
    s === '0' ||
    s === '-' ||
    s === '—'
  );
}

function matchComponent(
  label: string | null,
  candidates: ComponentOption[],
): { id: string | null; matched: boolean } {
  if (!label) return { id: null, matched: false };
  const norm = label.toLowerCase().trim();
  if (norm === '') return { id: null, matched: false };

  // 1) Exact "manufacturer model" or "model" normalized match.
  for (const c of candidates) {
    const full = `${c.manufacturer} ${c.model}`.toLowerCase().trim();
    const model = c.model.toLowerCase().trim();
    if (full === norm || model === norm) return { id: c.id, matched: true };
  }
  // 2) Substring (case-insensitive) against "manufacturer model" or model.
  for (const c of candidates) {
    const full = `${c.manufacturer} ${c.model}`.toLowerCase();
    const model = c.model.toLowerCase();
    if (full.includes(norm) || norm.includes(model)) {
      return { id: c.id, matched: true };
    }
  }
  return { id: null, matched: false };
}

export function parseBatchPublishedRows(
  text: string,
  opts: {
    bullets: ComponentOption[];
    powders: ComponentOption[];
  } = { bullets: [], powders: [] },
): ParseBatchResult {
  const trimmed = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) {
    return {
      headerDetected: false,
      rows: [],
      fatalError: 'No content. Paste CSV/TSV rows above.',
    };
  }

  const rawLines = trimmed
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));

  if (rawLines.length === 0) {
    return {
      headerDetected: false,
      rows: [],
      fatalError: 'No content rows.',
    };
  }

  const delim = detectDelimiter(rawLines[0]);
  const firstCells = splitLine(rawLines[0], delim);

  // Header detection: if the first row's cells normalize to known header
  // aliases (majority), treat it as a header row.
  const knownCount = firstCells.filter((c) => canonFor(c) !== null).length;
  const headerDetected =
    firstCells.length >= 2 && knownCount >= Math.ceil(firstCells.length / 2);

  let order: (Canon | null)[];
  let dataLines: string[];
  if (headerDetected) {
    order = firstCells.map((c) => canonFor(c));
    dataLines = rawLines.slice(1);
    // Required: at least bullet AND powder header present.
    if (!order.includes('bullet') || !order.includes('powder')) {
      return {
        headerDetected: true,
        rows: [],
        fatalError:
          'Header is missing required "bullet" and "powder" columns.',
      };
    }
  } else {
    // No-header tolerance: assume DEFAULT_HEADER_ORDER but only as many
    // columns as the first row has.
    order = DEFAULT_HEADER_ORDER.slice(0, firstCells.length);
    dataLines = rawLines;
  }

  const rows: ParsedBatchRow[] = [];
  dataLines.forEach((line, idx) => {
    const cells = splitLine(line, delim);
    const errors: ParsedBatchRowError[] = [];
    const warnings: ParsedBatchRowError[] = [];

    const values: ParsedBatchRowValues = {
      bulletName: null,
      powderName: null,
      bulletComponentId: null,
      powderComponentId: null,
      chargeGr: null,
      velocityFps: null,
      publishedMaxChargeGr: null,
      isMaxLoad: false,
      colIn: null,
      pageLabel: null,
      notes: null,
    };

    order.forEach((canon, i) => {
      if (canon === null) return;
      const raw = cells[i] ?? '';
      switch (canon) {
        case 'bullet': {
          const s = raw.trim();
          values.bulletName = s === '' ? null : s;
          break;
        }
        case 'powder': {
          const s = raw.trim();
          values.powderName = s === '' ? null : s;
          break;
        }
        case 'velocity': {
          const { value, error } = parseNumber(raw);
          if (error) errors.push({ field: 'velocityFps', message: error });
          else if (value !== null && value > 10000)
            errors.push({
              field: 'velocityFps',
              message: `velocity ${value} fps out of range`,
            });
          else values.velocityFps = value;
          break;
        }
        case 'charge': {
          const { value, error } = parseNumber(raw);
          if (error) errors.push({ field: 'chargeGr', message: error });
          else values.chargeGr = value;
          break;
        }
        case 'max': {
          const { value, error } = parseNumber(raw);
          if (error)
            errors.push({ field: 'publishedMaxChargeGr', message: error });
          else values.publishedMaxChargeGr = value;
          break;
        }
        case 'isMax': {
          if (raw.trim() === '') values.isMaxLoad = false;
          else if (isFalseLike(raw)) values.isMaxLoad = false;
          else values.isMaxLoad = parseBool(raw);
          break;
        }
        case 'col': {
          const { value, error } = parseNumber(raw);
          if (error) errors.push({ field: 'colIn', message: error });
          else if (value !== null && value > 10)
            errors.push({ field: 'colIn', message: `COL ${value} out of range` });
          else values.colIn = value;
          break;
        }
        case 'page': {
          const s = raw.trim();
          values.pageLabel = s === '' ? null : s.slice(0, 120);
          break;
        }
        case 'notes': {
          const s = raw.trim();
          values.notes = s === '' ? null : s.slice(0, 4000);
          break;
        }
      }
    });

    // Component matching against workspace bullets/powders.
    const bulletMatch = matchComponent(values.bulletName, opts.bullets);
    values.bulletComponentId = bulletMatch.id;
    const powderMatch = matchComponent(values.powderName, opts.powders);
    values.powderComponentId = powderMatch.id;

    if (values.bulletName && !bulletMatch.matched) {
      warnings.push({
        field: 'bulletComponentId',
        message: `No workspace bullet matched "${values.bulletName}" — free-text label preserved.`,
      });
    }
    if (values.powderName && !powderMatch.matched) {
      warnings.push({
        field: 'powderComponentId',
        message: `No workspace powder matched "${values.powderName}" — free-text label preserved.`,
      });
    }

    // Required-ish: row must have at least bullet OR powder OR a charge to be
    // meaningful. Pure blank rows after delimiter split are skipped silently.
    const allBlank = cells.every((c) => c.trim() === '');
    if (allBlank) return;

    if (!values.bulletName && !values.powderName && values.chargeGr === null) {
      errors.push({
        message:
          'Row needs at least a bullet, powder, or charge value to stage.',
      });
    }

    rows.push({
      rowNumber: idx + 1,
      raw: line,
      values,
      errors,
      warnings,
    });
  });

  return { headerDetected, rows, fatalError: null };
}
