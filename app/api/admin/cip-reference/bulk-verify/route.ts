// POST /api/admin/cip-reference/bulk-verify
//
// Admin-only endpoint that promotes a list of selected DRAFT / PENDING_REVIEW
// CipReferenceRecord rows to VERIFIED in a single submission. The flow is
// gated behind:
//
//   1. getAdminContext() — same Clerk + LOADBENCH_ADMIN_EMAILS gate as the
//      single-row verify endpoint.
//   2. getWorkspaceContext() — every selected row id is constrained to the
//      caller's workspace before promotion (defence-in-depth on top of the
//      Prisma scope filter inside bulkVerifyCipRecords).
//   3. An explicit `acknowledgedVerifiedAgainstSource=on` checkbox in the
//      form. The validator rejects the submission outright if it's missing
//      with the exact safety-boundary copy the single-row form uses.
//   4. findForbiddenKeys() defence-in-depth: any inbound pressure-prediction
//      key (predictedPressurePsi, recommendedCharge, safeOrUnsafe, …) is
//      rejected before the schema parses. Bulk verify never produces a
//      per-handload prediction or load recommendation — it only flips a
//      verification status flag on metadata rows.
//
// Row-level skips (RETIRED, missing sourceUrl, already verified, not found)
// are surfaced in the redirect query string so the admin sees exactly which
// rows were promoted and why others were not. A malformed selection never
// fails the whole batch.

import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { findForbiddenKeys } from '@/lib/ballistics/modelAdapter';
import { cipRecordBulkVerifySchema } from '@/lib/validation/cipReference';
import {
  bulkVerifyCipRecords,
  type CipBulkVerifySkipReason,
} from '@/lib/validation/cipReferenceDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}

function redirectBack(request: Request, message: string, error = false) {
  const params = new URLSearchParams();
  if (error) params.set('error', message);
  else params.set('ok', message);
  const url = new URL('/admin/shooters-world-cip', request.url);
  url.search = params.toString();
  return NextResponse.redirect(url, { status: 303 });
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return (await req.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const form = await req.formData();
  const obj: Record<string, unknown> = {};
  // Multiple checkboxes share the same name="recordId" — collect into a list.
  const ids: string[] = [];
  for (const [k, v] of form.entries()) {
    if (k === 'recordId' && typeof v === 'string' && v.length > 0) {
      ids.push(v);
    } else if (k === 'recordIds[]' && typeof v === 'string' && v.length > 0) {
      ids.push(v);
    } else {
      obj[k] = typeof v === 'string' ? v : null;
    }
  }
  if (ids.length > 0) obj.recordIds = ids;
  if (obj.acknowledgedVerifiedAgainstSource === 'on') {
    obj.acknowledgedVerifiedAgainstSource = true;
  }
  return obj;
}

function describeSkip(reason: CipBulkVerifySkipReason): string {
  switch (reason) {
    case 'NOT_FOUND':
      return 'not in this workspace';
    case 'RETIRED':
      return 'retired (use the restore flow first)';
    case 'ALREADY_VERIFIED':
      return 'already verified';
    case 'MISSING_SOURCE_URL':
      return 'missing source URL';
    case 'MISSING_CARTRIDGE_NAME':
      return 'missing cartridge name';
  }
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return redirectBack(
      request,
      e instanceof Error ? e.message : 'No workspace context.',
      true,
    );
  }

  const raw = await readBody(request);

  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return redirectBack(
      request,
      `Forbidden keys rejected: ${forbidden.join(', ')}. Bulk-verify only flips a verification status flag on reference metadata; it never accepts pressure-prediction or load-recommendation fields.`,
      true,
    );
  }

  const parsed = cipRecordBulkVerifySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.join('.') || 'form';
    return redirectBack(
      request,
      `Cannot bulk-verify (${where}): ${issue.message}`,
      true,
    );
  }

  let outcome;
  try {
    outcome = await bulkVerifyCipRecords(
      ctx.workspaceId,
      parsed.data.recordIds,
      admin.email ?? null,
    );
  } catch (e) {
    return redirectBack(
      request,
      e instanceof Error
        ? `Bulk verify failed: ${e.message}`
        : 'Bulk verify failed.',
      true,
    );
  }

  const approvedCount = outcome.approved.length;
  const skippedCount = outcome.skipped.length;

  if (approvedCount === 0 && skippedCount === 0) {
    return redirectBack(request, 'No rows were submitted for bulk verify.', true);
  }

  // Group skipped rows by reason for a compact summary in the flash message.
  const skippedByReason = new Map<CipBulkVerifySkipReason, number>();
  for (const s of outcome.skipped) {
    skippedByReason.set(s.reason, (skippedByReason.get(s.reason) ?? 0) + 1);
  }
  const skipSummary = Array.from(skippedByReason.entries())
    .map(([r, n]) => `${n} ${describeSkip(r)}`)
    .join(', ');

  if (approvedCount === 0) {
    return redirectBack(
      request,
      `Bulk verify approved 0 rows. Skipped ${skippedCount}: ${skipSummary}. Pressure prediction remains disabled.`,
      true,
    );
  }

  const okMsg =
    skippedCount === 0
      ? `Bulk verify approved ${approvedCount} reference row(s). Pressure prediction remains disabled.`
      : `Bulk verify approved ${approvedCount} reference row(s); skipped ${skippedCount} (${skipSummary}). Pressure prediction remains disabled.`;

  return redirectBack(request, okMsg);
}
