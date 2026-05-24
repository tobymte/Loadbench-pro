// Chronograph CSV parsing + summary statistics.
// Records what the user measured. No interpretation, no recommendations.

export type ChronoShot = {
  rowIndex: number;
  shot: number | null;
  velocityFps: number;
  note: string | null;
};

export type ChronoInvalidRow = {
  rowIndex: number;
  raw: string;
  reason: string;
};

export type ChronoWarning = {
  code:
    | 'UNIT_MPS_CONVERTED'
    | 'SUSPICIOUS_LOW'
    | 'SUSPICIOUS_HIGH'
    | 'MISSING_SHOT_NUMBERS'
    | 'DUPLICATE_SHOT_NUMBERS'
    | 'OUTLIER_SD';
  message: string;
};

export type ChronoUnit = 'fps' | 'mps' | 'unknown';

export type ChronoParseResult = {
  shots: ChronoShot[];
  invalid: ChronoInvalidRow[];
  headerDetected: boolean;
  detectedUnit: ChronoUnit;
  warnings: ChronoWarning[];
};

export type ChronoSummary = {
  count: number;
  avgVelocityFps: number | null;
  minFps: number | null;
  maxFps: number | null;
  esFps: number | null;
  sdFps: number | null;
};

const SHOT_HEADERS = new Set([
  'shot',
  'shot#',
  'shotnumber',
  'shotno',
  'no',
  '#',
  'index',
]);
const VELOCITY_HEADERS = new Set([
  'velocity',
  'velocityfps',
  'velocity(fps)',
  'velocity(f/s)',
  'fps',
  'vel',
  'v',
  'speed',
  'muzzlevelocity',
  'mv',
  // Common manufacturer variants
  'velocityfeetpersecond',
]);
const VELOCITY_HEADERS_MPS = new Set([
  'velocitymps',
  'velocity(mps)',
  'velocity(m/s)',
  'mps',
  'm/s',
]);
const NOTE_HEADERS = new Set(['note', 'notes', 'comment', 'comments']);

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_()]+/g, '');
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function detectDelimiter(line: string): ',' | '\t' | ';' {
  // Pick whichever delimiter produces more cells, preferring comma when tied.
  const counts: Record<',' | '\t' | ';', number> = {
    ',': (line.match(/,/g) ?? []).length,
    '\t': (line.match(/\t/g) ?? []).length,
    ';': (line.match(/;/g) ?? []).length,
  };
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

function splitLine(line: string, delimiter: ',' | '\t' | ';'): string[] {
  if (delimiter === ',') return splitCsvLine(line);
  // Simple split for tab / semicolon; chronograph exports rarely embed those
  // inside quoted strings.
  return line
    .split(delimiter === '\t' ? /\t/ : /;/)
    .map((c) => c.trim().replace(/^"|"$/g, ''));
}

export function parseChronoCsv(csv: string): ChronoParseResult {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const shots: ChronoShot[] = [];
  const invalid: ChronoInvalidRow[] = [];
  const warnings: ChronoWarning[] = [];
  let detectedUnit: ChronoUnit = 'unknown';

  if (lines.length === 0) {
    return { shots, invalid, headerDetected: false, detectedUnit, warnings };
  }

  const delimiter = detectDelimiter(lines[0]);

  let velocityIdx = 1;
  let shotIdx = 0;
  let noteIdx: number | null = 2;
  let headerDetected = false;
  let startRow = 0;
  let unitIsMps = false;

  const firstCells = splitLine(lines[0], delimiter).map(normalizeHeader);
  const looksLikeHeader = firstCells.some(
    (c) =>
      SHOT_HEADERS.has(c) ||
      VELOCITY_HEADERS.has(c) ||
      VELOCITY_HEADERS_MPS.has(c) ||
      NOTE_HEADERS.has(c),
  );

  if (looksLikeHeader) {
    headerDetected = true;
    startRow = 1;
    shotIdx = -1;
    velocityIdx = -1;
    noteIdx = null;
    firstCells.forEach((c, idx) => {
      if (SHOT_HEADERS.has(c) && shotIdx === -1) shotIdx = idx;
      else if (VELOCITY_HEADERS.has(c) && velocityIdx === -1) {
        velocityIdx = idx;
        detectedUnit = 'fps';
      } else if (VELOCITY_HEADERS_MPS.has(c) && velocityIdx === -1) {
        velocityIdx = idx;
        unitIsMps = true;
        detectedUnit = 'mps';
      } else if (NOTE_HEADERS.has(c) && noteIdx === null) noteIdx = idx;
    });
    if (velocityIdx === -1) {
      const next = lines[1];
      if (next) {
        const cells = splitLine(next, delimiter);
        for (let i = 0; i < cells.length; i++) {
          if (Number.isFinite(Number(cells[i]))) {
            velocityIdx = i;
            break;
          }
        }
      }
    }
  }

  for (let i = startRow; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    if (cells.length === 0 || cells.every((c) => c === '')) continue;

    const rowIndex = i + 1;
    let velocity: number | null = null;
    let shotNumber: number | null = null;
    let note: string | null = null;

    if (cells.length === 1) {
      const v = Number(cells[0]);
      if (Number.isFinite(v)) velocity = v;
    } else {
      if (velocityIdx >= 0 && cells[velocityIdx] !== undefined) {
        const v = Number(cells[velocityIdx]);
        if (Number.isFinite(v)) velocity = v;
      }
      if (shotIdx >= 0 && cells[shotIdx] !== undefined && cells[shotIdx] !== '') {
        const s = Number(cells[shotIdx]);
        if (Number.isFinite(s) && Number.isInteger(s) && s >= 0) {
          shotNumber = s;
        }
      }
      if (noteIdx != null && cells[noteIdx] !== undefined) {
        const n = cells[noteIdx];
        note = n === '' ? null : n;
      }
    }

    if (velocity == null) {
      invalid.push({
        rowIndex,
        raw: lines[i],
        reason: 'No velocity value parsed (column non-numeric or empty).',
      });
      continue;
    }

    if (unitIsMps) {
      velocity = velocity * 3.28084;
    } else if (detectedUnit === 'unknown' && velocity > 0 && velocity < 1500) {
      // Heuristic: many m/s muzzle velocities for centerfire rifles fall in
      // 600–1100 m/s. If header didn't tell us and the value looks too low for
      // fps, leave it alone but warn — never silently convert.
    }

    if (velocity <= 0 || velocity > 10000) {
      invalid.push({
        rowIndex,
        raw: lines[i],
        reason: 'Velocity outside plausible range (0–10000 fps).',
      });
      continue;
    }

    shots.push({
      rowIndex,
      shot: shotNumber,
      velocityFps: Math.round(velocity * 10) / 10,
      note,
    });
  }

  if (detectedUnit === 'unknown' && shots.length > 0) {
    const avg = shots.reduce((a, s) => a + s.velocityFps, 0) / shots.length;
    if (avg > 0 && avg < 1500) {
      // Treat as m/s if all values look like metric muzzle speeds.
      detectedUnit = 'mps';
      for (const s of shots) {
        s.velocityFps = Math.round(s.velocityFps * 3.28084 * 10) / 10;
      }
      warnings.push({
        code: 'UNIT_MPS_CONVERTED',
        message:
          'Detected metric (m/s) values based on magnitude. Converted to fps. If your chrono actually exports fps, double-check the file.',
      });
    } else {
      detectedUnit = 'fps';
    }
  } else if (unitIsMps) {
    warnings.push({
      code: 'UNIT_MPS_CONVERTED',
      message:
        'Detected m/s column header. Values were converted to fps for the session record.',
    });
  }

  if (shots.length > 0) {
    const numbered = shots.filter((s) => s.shot != null);
    if (numbered.length === 0) {
      warnings.push({
        code: 'MISSING_SHOT_NUMBERS',
        message:
          'No shot numbers detected — shots will be numbered in import order.',
      });
    } else if (numbered.length < shots.length) {
      warnings.push({
        code: 'MISSING_SHOT_NUMBERS',
        message: `Some rows are missing shot numbers (${shots.length - numbered.length} of ${shots.length}).`,
      });
    }
    const seen = new Set<number>();
    for (const s of numbered) {
      if (s.shot != null && seen.has(s.shot)) {
        warnings.push({
          code: 'DUPLICATE_SHOT_NUMBERS',
          message: `Duplicate shot number detected (#${s.shot}).`,
        });
        break;
      }
      if (s.shot != null) seen.add(s.shot);
    }
    const vmin = Math.min(...shots.map((s) => s.velocityFps));
    const vmax = Math.max(...shots.map((s) => s.velocityFps));
    if (vmin < 500) {
      warnings.push({
        code: 'SUSPICIOUS_LOW',
        message: `One or more velocities are below 500 fps (min ${vmin}). Confirm units and column mapping.`,
      });
    }
    if (vmax > 5000) {
      warnings.push({
        code: 'SUSPICIOUS_HIGH',
        message: `One or more velocities exceed 5000 fps (max ${vmax}). Confirm the column maps to muzzle velocity.`,
      });
    }
  }

  return { shots, invalid, headerDetected, detectedUnit, warnings };
}

export function summarizeChrono(shots: ChronoShot[]): ChronoSummary {
  const count = shots.length;
  if (count === 0) {
    return {
      count: 0,
      avgVelocityFps: null,
      minFps: null,
      maxFps: null,
      esFps: null,
      sdFps: null,
    };
  }

  const velocities = shots.map((s) => s.velocityFps);
  const sum = velocities.reduce((a, b) => a + b, 0);
  const avg = sum / count;
  const min = Math.min(...velocities);
  const max = Math.max(...velocities);
  const es = max - min;

  let sd: number | null = null;
  if (count > 1) {
    const variance =
      velocities.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) /
      (count - 1);
    sd = Math.sqrt(variance);
  }

  return {
    count,
    avgVelocityFps: Math.round(avg * 10) / 10,
    minFps: Math.round(min * 10) / 10,
    maxFps: Math.round(max * 10) / 10,
    esFps: Math.round(es * 10) / 10,
    sdFps: sd != null ? Math.round(sd * 10) / 10 : null,
  };
}
