import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { findForbiddenKeys } from '@/lib/ballistics/modelAdapter';
import {
  cipRecordCreateSchema,
} from '@/lib/validation/cipReference';
import { createCipRecord } from '@/lib/validation/cipReferenceDb';
import {
  bulkRowToCreateInput,
  parseCipBulkCsv,
  type CipBulkRow,
} from '@/lib/validation/cipBulkCsv';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_CSV_BYTES = 1_000_000; // 1 MB cap on pasted/uploaded CSV
const MAX_ROWS = 500;

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error.';
  }
}

type BulkRequestBody = {
  csv?: string;
  acknowledgedDraftOnly?: boolean;
  mode?: 'preview' | 'commit';
};

async function readBody(req: Request): Promise<BulkRequestBody> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return (await req.json()) as BulkRequestBody;
    } catch {
      return {};
    }
  }
  try {
    const form = await req.formData();
    const obj: BulkRequestBody = {};
    const csv = form.get('csv');
    if (typeof csv === 'string') obj.csv = csv;
    const ack = form.get('acknowledgedDraftOnly');
    obj.acknowledgedDraftOnly = ack === 'true' || ack === 'on' || ack === '1';
    const mode = form.get('mode');
    if (mode === 'preview' || mode === 'commit') obj.mode = mode;
    return obj;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = await readBody(request);
  const csv = (body.csv ?? '').toString();
  const mode = body.mode ?? 'preview';

  if (!csv.trim()) {
    return jsonError('CSV body is empty. Paste rows or upload a file.');
  }
  if (csv.length > MAX_CSV_BYTES) {
    return jsonError(
      `CSV body exceeds ${MAX_CSV_BYTES} bytes. Split the import into smaller batches.`,
    );
  }

  // Defence-in-depth: reject if the raw CSV body contains any forbidden output
  // key string. Headers / cells with these names must never be accepted, even
  // transiently, by the CIP reference center.
  const forbidden = findForbiddenKeys({ csv });
  if (forbidden.length > 0) {
    return jsonError(
      `Forbidden keys detected in CSV body: ${forbidden.join(', ')}. CIP reference rows store published metadata only.`,
      400,
    );
  }

  const parsed = parseCipBulkCsv(csv);
  if (parsed.fatalError) {
    return jsonError(parsed.fatalError, 400, {
      headerDetected: parsed.headerDetected,
    });
  }

  if (parsed.rows.length === 0) {
    return jsonError('No data rows found after the header.', 400);
  }

  if (parsed.rows.length > MAX_ROWS) {
    return jsonError(
      `Too many rows (${parsed.rows.length}). Limit ${MAX_ROWS} per import — split into smaller batches.`,
      400,
    );
  }

  const totalErrors = parsed.rows.reduce((n, r) => n + r.errors.length, 0);
  const totalWarnings = parsed.rows.reduce((n, r) => n + r.warnings.length, 0);

  if (mode === 'preview') {
    return NextResponse.json({
      ok: true,
      mode: 'preview',
      headerDetected: parsed.headerDetected,
      rowCount: parsed.rows.length,
      totalErrors,
      totalWarnings,
      rows: parsed.rows,
    });
  }

  // mode === 'commit'
  if (!body.acknowledgedDraftOnly) {
    return jsonError(
      'Admin acknowledgement required. Confirm that imported rows will land as DRAFT and that you will compare each row against its cited source before verification.',
      400,
    );
  }
  if (totalErrors > 0) {
    return jsonError(
      `Cannot import: ${totalErrors} row error(s) must be fixed first.`,
      400,
      { totalErrors, totalWarnings },
    );
  }

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return jsonError(describeError(e), 500);
  }

  const created: { rowNumber: number; id: string; cartridgeName: string }[] = [];
  const failed: { rowNumber: number; message: string }[] = [];

  for (const row of parsed.rows) {
    const result = await commitRow(row, ctx.workspaceId, admin.email ?? null);
    if (result.ok) {
      created.push({
        rowNumber: row.rowNumber,
        id: result.id,
        cartridgeName: result.cartridgeName,
      });
    } else {
      failed.push({ rowNumber: row.rowNumber, message: result.message });
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    mode: 'commit',
    createdCount: created.length,
    failedCount: failed.length,
    created,
    failed,
    totalWarnings,
    note:
      'All imported rows saved as DRAFT (never auto-verified). Verify each row individually after comparing against the cited source.',
  });
}

async function commitRow(
  row: CipBulkRow,
  workspaceId: string,
  createdByEmail: string | null,
): Promise<
  | { ok: true; id: string; cartridgeName: string }
  | { ok: false; message: string }
> {
  const input = bulkRowToCreateInput(row.values);
  if (!input) {
    return { ok: false, message: 'Row missing required cartridgeName.' };
  }

  // Re-validate through the shared Zod schema (same gate as single-row POST).
  const parsed = cipRecordCreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: `Schema rejected row: ${issue.path.join('.') || 'row'} — ${issue.message}`,
    };
  }

  // Belt-and-braces forbidden-key check on the per-row payload.
  const forbidden = findForbiddenKeys(parsed.data as Record<string, unknown>);
  if (forbidden.length > 0) {
    return {
      ok: false,
      message: `Forbidden keys on row: ${forbidden.join(', ')}.`,
    };
  }

  try {
    // createCipRecord always sets verificationStatus = DRAFT — see
    // lib/validation/cipReferenceDb.ts. Bulk import never overrides that.
    const created = await createCipRecord(
      workspaceId,
      createdByEmail,
      parsed.data,
    );
    return { ok: true, id: created.id, cartridgeName: created.cartridgeName };
  } catch (e) {
    return { ok: false, message: describeError(e) };
  }
}
