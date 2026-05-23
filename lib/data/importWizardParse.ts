// Paste parsers for the Guided Data Import Wizard at /data-import.
//
// These parsers turn user-pasted CSV/TSV text into a structured row preview
// for one of several non-pressure-bearing import categories. They do NOT
// compute pressure, predict velocity, recommend charges, or label any row
// safe or unsafe. They only validate basic shape/range so the user can
// confirm parsing before staging or persisting a row.

export type WizardCategory =
  | 'published'
  | 'chrono'
  | 'inventory'
  | 'caseCapacity'
  | 'bulletMeta'
  | 'powderMeta';

export type WizardRowError = { field?: string; message: string };

export type WizardParsedRow<V> = {
  rowNumber: number;
  raw: string;
  values: V;
  errors: WizardRowError[];
  warnings: WizardRowError[];
};

export type WizardParseResult<V> = {
  headerDetected: boolean;
  rows: WizardParsedRow<V>[];
  fatalError: string | null;
};

type Canon = string;

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectDelimiter(line: string): ',' | '\t' {
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

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

function parseNum(
  raw: string,
  opts: { min?: number; max?: number; allowZero?: boolean } = {},
): { value: number | null; error?: string } {
  const s = (raw ?? '').trim();
  if (s === '' || s === '-' || s === '—') return { value: null };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { value: null, error: `not a number: "${raw}"` };
  if (!opts.allowZero && n <= 0) return { value: null, error: `must be > 0: "${raw}"` };
  if (opts.allowZero && n < 0) return { value: null, error: `must be ≥ 0: "${raw}"` };
  if (opts.min != null && n < opts.min)
    return { value: null, error: `below ${opts.min}: "${raw}"` };
  if (opts.max != null && n > opts.max)
    return { value: null, error: `above ${opts.max}: "${raw}"` };
  return { value: n };
}

function parseInt0(raw: string): { value: number | null; error?: string } {
  const r = parseNum(raw, { allowZero: true });
  if (r.value === null) return r;
  if (!Number.isInteger(r.value))
    return { value: null, error: `not an integer: "${raw}"` };
  return r;
}

// Generic header-based parser. Caller supplies field schema.
type FieldSpec<V> = {
  key: keyof V & string;
  aliases: string[];
  parse: (raw: string) => {
    value: unknown;
    error?: string;
    warning?: string;
  };
  required?: boolean;
};

function canonFor<V>(header: string, specs: FieldSpec<V>[]): FieldSpec<V> | null {
  const k = normalizeKey(header);
  for (const spec of specs) {
    if (spec.aliases.some((a) => normalizeKey(a) === k)) return spec;
  }
  return null;
}

function parseGeneric<V extends Record<string, unknown>>(
  text: string,
  specs: FieldSpec<V>[],
  blank: V,
  opts: {
    headerRequired: boolean;
    requireOneOf?: Array<keyof V & string>;
    requireOneOfMessage?: string;
  },
): WizardParseResult<V> {
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
    return { headerDetected: false, rows: [], fatalError: 'No content rows.' };
  }

  const delim = detectDelimiter(rawLines[0]);
  const firstCells = splitLine(rawLines[0], delim);
  const knownCount = firstCells.filter((c) => canonFor(c, specs) !== null).length;
  const headerDetected =
    firstCells.length >= 2 && knownCount >= Math.ceil(firstCells.length / 2);

  if (opts.headerRequired && !headerDetected) {
    return {
      headerDetected: false,
      rows: [],
      fatalError:
        'A header row is required. The first row must list column names — see the example.',
    };
  }

  let order: (FieldSpec<V> | null)[];
  let dataLines: string[];
  if (headerDetected) {
    order = firstCells.map((c) => canonFor(c, specs));
    dataLines = rawLines.slice(1);
    // Verify required header fields present.
    const missingReq = specs
      .filter((s) => s.required)
      .filter((s) => !order.find((o) => o?.key === s.key));
    if (missingReq.length > 0) {
      return {
        headerDetected: true,
        rows: [],
        fatalError: `Missing required column${missingReq.length === 1 ? '' : 's'}: ${missingReq.map((m) => m.key).join(', ')}.`,
      };
    }
  } else {
    // Assume the first N spec fields are positional.
    order = specs.slice(0, firstCells.length);
    dataLines = rawLines;
  }

  const rows: WizardParsedRow<V>[] = [];
  dataLines.forEach((line, idx) => {
    const cells = splitLine(line, delim);
    const allBlank = cells.every((c) => c.trim() === '');
    if (allBlank) return;

    const values: V = { ...blank };
    const errors: WizardRowError[] = [];
    const warnings: WizardRowError[] = [];

    order.forEach((spec, i) => {
      if (!spec) return;
      const raw = cells[i] ?? '';
      const out = spec.parse(raw);
      if (out.error) {
        errors.push({ field: spec.key, message: out.error });
      } else if (out.value !== undefined) {
        (values as Record<string, unknown>)[spec.key] = out.value;
      }
      if (out.warning) warnings.push({ field: spec.key, message: out.warning });
    });

    // Required-field check.
    specs
      .filter((s) => s.required)
      .forEach((s) => {
        const v = (values as Record<string, unknown>)[s.key];
        if (v === null || v === undefined || v === '') {
          errors.push({ field: s.key, message: `${s.key} is required.` });
        }
      });

    if (opts.requireOneOf && opts.requireOneOf.length > 0) {
      const anyPresent = opts.requireOneOf.some((k) => {
        const v = (values as Record<string, unknown>)[k];
        return v !== null && v !== undefined && v !== '';
      });
      if (!anyPresent) {
        errors.push({
          message:
            opts.requireOneOfMessage ??
            `Row must have at least one of: ${opts.requireOneOf.join(', ')}.`,
        });
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

  return { headerDetected, rows, fatalError: null };
}

function strField(raw: string, max: number): { value: string | null } {
  const s = (raw ?? '').trim();
  if (s === '') return { value: null };
  return { value: s.slice(0, max) };
}

// ---------- Component inventory ----------

export type InventoryRow = {
  kind: 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE' | null;
  manufacturer: string | null;
  model: string | null;
  lotNumber: string | null;
  quantityOnHand: number | null;
  unit: string | null;
  bulletWeightGr: number | null;
  bulletBc: number | null;
  burnRateLabel: string | null;
  notes: string | null;
};

const INVENTORY_BLANK: InventoryRow = {
  kind: null,
  manufacturer: null,
  model: null,
  lotNumber: null,
  quantityOnHand: null,
  unit: null,
  bulletWeightGr: null,
  bulletBc: null,
  burnRateLabel: null,
  notes: null,
};

function parseKind(raw: string): { value: InventoryRow['kind']; error?: string } {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === '') return { value: null };
  if (['bullet', 'b'].includes(s)) return { value: 'BULLET' };
  if (['powder', 'p'].includes(s)) return { value: 'POWDER' };
  if (['primer', 'pr'].includes(s)) return { value: 'PRIMER' };
  if (['case', 'brass', 'c'].includes(s)) return { value: 'CASE' };
  return { value: null, error: `unknown kind: "${raw}" (use BULLET, POWDER, PRIMER, or CASE)` };
}

const INVENTORY_SPECS: FieldSpec<InventoryRow>[] = [
  {
    key: 'kind',
    aliases: ['kind', 'type', 'category'],
    parse: parseKind,
    required: true,
  },
  {
    key: 'manufacturer',
    aliases: ['manufacturer', 'mfg', 'mfr', 'brand'],
    parse: (r) => strField(r, 120),
    required: true,
  },
  {
    key: 'model',
    aliases: ['model', 'product', 'name'],
    parse: (r) => strField(r, 120),
    required: true,
  },
  {
    key: 'lotNumber',
    aliases: ['lot', 'lotnumber', 'lotno'],
    parse: (r) => strField(r, 60),
  },
  {
    key: 'quantityOnHand',
    aliases: ['qty', 'quantity', 'quantityonhand', 'onhand'],
    parse: (r) => parseNum(r, { allowZero: true, max: 1_000_000 }),
  },
  {
    key: 'unit',
    aliases: ['unit', 'units'],
    parse: (r) => strField(r, 20),
  },
  {
    key: 'bulletWeightGr',
    aliases: ['bulletweightgr', 'bulletweight', 'weightgr', 'grains'],
    parse: (r) => parseNum(r, { max: 2000 }),
  },
  {
    key: 'bulletBc',
    aliases: ['bulletbc', 'bc', 'g1bc'],
    parse: (r) => parseNum(r, { max: 5 }),
  },
  {
    key: 'burnRateLabel',
    aliases: ['burnrate', 'burnratelabel', 'powderlabel'],
    parse: (r) => strField(r, 60),
  },
  {
    key: 'notes',
    aliases: ['notes', 'note'],
    parse: (r) => strField(r, 4000),
  },
];

export function parseInventoryRows(text: string): WizardParseResult<InventoryRow> {
  return parseGeneric<InventoryRow>(text, INVENTORY_SPECS, INVENTORY_BLANK, {
    headerRequired: true,
  });
}

export const INVENTORY_HEADER =
  'kind,manufacturer,model,lotNumber,quantityOnHand,unit,bulletWeightGr,bulletBc,burnRateLabel,notes';
export const INVENTORY_EXAMPLE = `${INVENTORY_HEADER}
BULLET,Hornady,ELD-M 140gr,LotA1,250,ct,140,0.610,,
POWDER,Hodgdon,H4350,LotP9,2.5,lb,,,medium burn,
PRIMER,CCI,BR2,LotPR1,1000,ct,,,,large rifle benchrest
CASE,Lapua,6.5 Creedmoor,LotC3,200,ct,,,,fired 2x`;

// ---------- Case capacity ----------

export type CaseCapacityRow = {
  cartridgeName: string | null;
  brassManufacturer: string | null;
  brassModel: string | null;
  lotNumber: string | null;
  method: string | null;
  firedOrResized: string | null;
  waterCapacityGr: number | null;
  avgCapacityGr: number | null;
  sdCapacityGr: number | null;
  sampleCount: number | null;
  tempF: number | null;
  notes: string | null;
};

const CAPACITY_BLANK: CaseCapacityRow = {
  cartridgeName: null,
  brassManufacturer: null,
  brassModel: null,
  lotNumber: null,
  method: null,
  firedOrResized: null,
  waterCapacityGr: null,
  avgCapacityGr: null,
  sdCapacityGr: null,
  sampleCount: null,
  tempF: null,
  notes: null,
};

const CAPACITY_SPECS: FieldSpec<CaseCapacityRow>[] = [
  {
    key: 'cartridgeName',
    aliases: ['cartridge', 'cartridgename'],
    parse: (r) => strField(r, 120),
  },
  {
    key: 'brassManufacturer',
    aliases: ['brassmanufacturer', 'brassmfg', 'brassbrand'],
    parse: (r) => strField(r, 120),
  },
  {
    key: 'brassModel',
    aliases: ['brassmodel', 'brassname'],
    parse: (r) => strField(r, 120),
  },
  {
    key: 'lotNumber',
    aliases: ['lot', 'lotnumber'],
    parse: (r) => strField(r, 120),
  },
  {
    key: 'method',
    aliases: ['method'],
    parse: (r) => strField(r, 120),
  },
  {
    key: 'firedOrResized',
    aliases: ['firedorresized', 'state', 'condition'],
    parse: (r) => strField(r, 40),
  },
  {
    key: 'waterCapacityGr',
    aliases: ['watercapacitygr', 'h2ogr', 'capacitygr'],
    parse: (r) => parseNum(r, { max: 2000 }),
  },
  {
    key: 'avgCapacityGr',
    aliases: ['avgcapacitygr', 'avg'],
    parse: (r) => parseNum(r, { max: 2000 }),
  },
  {
    key: 'sdCapacityGr',
    aliases: ['sdcapacitygr', 'sd'],
    parse: (r) => parseNum(r, { max: 2000, allowZero: true }),
  },
  {
    key: 'sampleCount',
    aliases: ['samplecount', 'n', 'samples'],
    parse: parseInt0,
  },
  {
    key: 'tempF',
    aliases: ['tempf', 'temperaturef', 'temp'],
    parse: (r) => parseNum(r, { min: -100, max: 250, allowZero: true }),
  },
  {
    key: 'notes',
    aliases: ['notes', 'note'],
    parse: (r) => strField(r, 4000),
  },
];

export function parseCaseCapacityRows(text: string): WizardParseResult<CaseCapacityRow> {
  return parseGeneric<CaseCapacityRow>(text, CAPACITY_SPECS, CAPACITY_BLANK, {
    headerRequired: true,
    requireOneOf: ['waterCapacityGr', 'avgCapacityGr'],
    requireOneOfMessage:
      'Row must include at least waterCapacityGr or avgCapacityGr.',
  });
}

export const CAPACITY_HEADER =
  'cartridgeName,brassManufacturer,brassModel,lotNumber,method,firedOrResized,waterCapacityGr,avgCapacityGr,sdCapacityGr,sampleCount,tempF,notes';
export const CAPACITY_EXAMPLE = `${CAPACITY_HEADER}
6mm ARC,Hornady,6mm ARC,LotA2,water-fill,fired-sized,33.8,33.8,0.12,5,68,after FL size`;

// ---------- Bullet metadata ----------

export type BulletMetaRow = {
  manufacturer: string | null;
  model: string | null;
  lotNumber: string | null;
  weightGr: number | null;
  diameterIn: number | null;
  lengthIn: number | null;
  bearingSurfaceIn: number | null;
  boatTailLengthIn: number | null;
  ogiveStyle: string | null;
  bcG1: number | null;
  bcG7: number | null;
  sampleCount: number | null;
  notes: string | null;
};

const BULLET_BLANK: BulletMetaRow = {
  manufacturer: null,
  model: null,
  lotNumber: null,
  weightGr: null,
  diameterIn: null,
  lengthIn: null,
  bearingSurfaceIn: null,
  boatTailLengthIn: null,
  ogiveStyle: null,
  bcG1: null,
  bcG7: null,
  sampleCount: null,
  notes: null,
};

const BULLET_SPECS: FieldSpec<BulletMetaRow>[] = [
  {
    key: 'manufacturer',
    aliases: ['manufacturer', 'mfg', 'mfr', 'brand'],
    parse: (r) => strField(r, 120),
    required: true,
  },
  {
    key: 'model',
    aliases: ['model', 'name'],
    parse: (r) => strField(r, 120),
    required: true,
  },
  { key: 'lotNumber', aliases: ['lot', 'lotnumber'], parse: (r) => strField(r, 120) },
  { key: 'weightGr', aliases: ['weightgr', 'weight', 'grains'], parse: (r) => parseNum(r, { max: 2000 }) },
  { key: 'diameterIn', aliases: ['diameterin', 'diameter', 'caliberin'], parse: (r) => parseNum(r, { max: 5 }) },
  { key: 'lengthIn', aliases: ['lengthin', 'length', 'oalin'], parse: (r) => parseNum(r, { max: 10 }) },
  { key: 'bearingSurfaceIn', aliases: ['bearingsurfacein', 'bearingsurface'], parse: (r) => parseNum(r, { max: 10 }) },
  { key: 'boatTailLengthIn', aliases: ['boattaillengthin', 'boattail'], parse: (r) => parseNum(r, { max: 5 }) },
  { key: 'ogiveStyle', aliases: ['ogivestyle', 'ogive'], parse: (r) => strField(r, 120) },
  { key: 'bcG1', aliases: ['bcg1', 'g1bc', 'g1'], parse: (r) => parseNum(r, { max: 5 }) },
  { key: 'bcG7', aliases: ['bcg7', 'g7bc', 'g7'], parse: (r) => parseNum(r, { max: 5 }) },
  { key: 'sampleCount', aliases: ['samplecount', 'n'], parse: parseInt0 },
  { key: 'notes', aliases: ['notes', 'note'], parse: (r) => strField(r, 4000) },
];

export function parseBulletMetaRows(text: string): WizardParseResult<BulletMetaRow> {
  return parseGeneric<BulletMetaRow>(text, BULLET_SPECS, BULLET_BLANK, {
    headerRequired: true,
  });
}

export const BULLET_META_HEADER =
  'manufacturer,model,lotNumber,weightGr,diameterIn,lengthIn,bearingSurfaceIn,boatTailLengthIn,ogiveStyle,bcG1,bcG7,sampleCount,notes';
export const BULLET_META_EXAMPLE = `${BULLET_META_HEADER}
Hornady,ELD-M 140gr,LotA1,140,0.264,1.450,0.620,0.190,secant,0.610,0.317,5,from spec sheet`;

// ---------- Powder metadata ----------

export type PowderMetaRow = {
  manufacturer: string | null;
  powderName: string | null;
  lotNumber: string | null;
  burnRateLabel: string | null;
  densityGcc: number | null;
  bulkDensityGrPerCc: number | null;
  kernelShape: string | null;
  tempSensitivityNotes: string | null;
  notes: string | null;
};

const POWDER_BLANK: PowderMetaRow = {
  manufacturer: null,
  powderName: null,
  lotNumber: null,
  burnRateLabel: null,
  densityGcc: null,
  bulkDensityGrPerCc: null,
  kernelShape: null,
  tempSensitivityNotes: null,
  notes: null,
};

const POWDER_SPECS: FieldSpec<PowderMetaRow>[] = [
  { key: 'manufacturer', aliases: ['manufacturer', 'mfg', 'brand'], parse: (r) => strField(r, 120), required: true },
  { key: 'powderName', aliases: ['powdername', 'name', 'powder'], parse: (r) => strField(r, 120), required: true },
  { key: 'lotNumber', aliases: ['lot', 'lotnumber'], parse: (r) => strField(r, 120) },
  { key: 'burnRateLabel', aliases: ['burnrate', 'burnratelabel'], parse: (r) => strField(r, 120) },
  { key: 'densityGcc', aliases: ['densitygcc', 'density'], parse: (r) => parseNum(r, { max: 10 }) },
  { key: 'bulkDensityGrPerCc', aliases: ['bulkdensitygrpercc', 'bulkdensity'], parse: (r) => parseNum(r, { max: 200 }) },
  { key: 'kernelShape', aliases: ['kernelshape', 'shape'], parse: (r) => strField(r, 120) },
  { key: 'tempSensitivityNotes', aliases: ['tempsensitivitynotes', 'tempsensitivity'], parse: (r) => strField(r, 4000) },
  { key: 'notes', aliases: ['notes', 'note'], parse: (r) => strField(r, 4000) },
];

export function parsePowderMetaRows(text: string): WizardParseResult<PowderMetaRow> {
  return parseGeneric<PowderMetaRow>(text, POWDER_SPECS, POWDER_BLANK, {
    headerRequired: true,
  });
}

export const POWDER_META_HEADER =
  'manufacturer,powderName,lotNumber,burnRateLabel,densityGcc,bulkDensityGrPerCc,kernelShape,tempSensitivityNotes,notes';
export const POWDER_META_EXAMPLE = `${POWDER_META_HEADER}
Hodgdon,H4350,LotP9,medium-slow,0.95,15.6,extruded,low temp sensitivity,from manufacturer site`;
