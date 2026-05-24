// Minimal RFC 4180 CSV encoder. We deliberately keep this in-repo (no new
// dependency) so exports are predictable and dependency-free.

export type CsvValue = string | number | boolean | Date | null | undefined;

function escapeCell(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) ? String(v) : '';
  }
  if (typeof v === 'boolean') {
    return v ? 'true' : 'false';
  }
  const s = String(v);
  // Quote if contains a special character per RFC 4180; double inner quotes.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  // CRLF per RFC 4180 — Excel-friendly.
  return lines.join('\r\n') + '\r\n';
}

export function csvResponse(filename: string, headers: string[], rows: CsvValue[][]) {
  const body = toCsv(headers, rows);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${sanitizeFilename(filename)}"`,
      'cache-control': 'no-store',
    },
  });
}

export function csvUnavailable(reason: string) {
  // 503 with a one-line CSV body so a curl client gets something useful.
  return new Response(`error\r\n"${reason.replace(/"/g, '""')}"\r\n`, {
    status: 503,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_');
}
