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

export type ChronoParseResult = {
  shots: ChronoShot[];
  invalid: ChronoInvalidRow[];
  headerDetected: boolean;
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
]);
const VELOCITY_HEADERS = new Set([
  'velocity',
  'velocityfps',
  'velocity(fps)',
  'fps',
  'vel',
  'v',
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

export function parseChronoCsv(csv: string): ChronoParseResult {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const shots: ChronoShot[] = [];
  const invalid: ChronoInvalidRow[] = [];

  if (lines.length === 0) {
    return { shots, invalid, headerDetected: false };
  }

  // Detect header: first row contains no parseable velocity number in the
  // first numeric-looking cell. If first cell tokens look like labels, treat
  // as header.
  let velocityIdx = 1;
  let shotIdx = 0;
  let noteIdx: number | null = 2;
  let headerDetected = false;
  let startRow = 0;

  const firstCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const looksLikeHeader = firstCells.some(
    (c) =>
      SHOT_HEADERS.has(c) ||
      VELOCITY_HEADERS.has(c) ||
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
      else if (VELOCITY_HEADERS.has(c) && velocityIdx === -1) velocityIdx = idx;
      else if (NOTE_HEADERS.has(c) && noteIdx === null) noteIdx = idx;
    });
    if (velocityIdx === -1) {
      // Fallback: pick first column that parses as number in row 1.
      const next = lines[1];
      if (next) {
        const cells = splitCsvLine(next);
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
    const cells = splitCsvLine(lines[i]);
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
        reason: 'No velocity value parsed.',
      });
      continue;
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
      velocityFps: velocity,
      note,
    });
  }

  return { shots, invalid, headerDetected };
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
