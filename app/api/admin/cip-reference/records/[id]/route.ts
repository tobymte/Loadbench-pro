import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  CIP_RECORD_UPDATABLE_KEYS,
  cipRecordUpdateSchema,
} from '@/lib/validation/cipReference';
import { updateCipRecord } from '@/lib/validation/cipReferenceDb';
import { findForbiddenKeys } from '@/lib/ballistics/modelAdapter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PATCH /api/admin/cip-reference/records/[id]
//
// Admin-only: edit fields on a single CipReferenceRecord row. Designed for the
// admin verification workflow where a bulk-imported row is missing data
// (typically sourceUrl) that the operator must supply before the row can be
// promoted to VERIFIED.
//
// SAFETY CONTRACT (defence-in-depth):
//   - rejects any inbound forbidden pressure-prediction keys (FORBIDDEN_OUTPUT_KEYS),
//   - rejects any key not in CIP_RECORD_UPDATABLE_KEYS (workspaceId, verifiedAt,
//     verifiedByEmail, verificationStatus, createdByEmail, id, …),
//   - never auto-verifies — verification remains a separate POST to
//     /api/admin/cip-reference/verify with an explicit acknowledgement.

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

async function readBody(req: Request): Promise<{
  data: Record<string, unknown>;
  isForm: boolean;
}> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const obj = (await req.json()) as Record<string, unknown>;
      return { data: obj, isForm: false };
    } catch {
      return { data: {}, isForm: false };
    }
  }
  const form = await req.formData();
  const obj: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') {
      obj[k] = null;
      continue;
    }
    // HTML forms cannot send `undefined` — empty string means "clear this
    // field" for nullable columns; zod's optional* helpers turn '' back into
    // undefined which is "leave alone". To allow the user to clear a field
    // via the form, the UI passes a sentinel value `__CLEAR__` that we
    // translate to an explicit null below.
    if (v === '__CLEAR__') {
      obj[k] = null;
    } else {
      obj[k] = v;
    }
  }
  return { data: obj, isForm: true };
}

async function patchHandler(
  request: Request,
  params: Promise<{ id: string }>,
) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();

  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>>;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No workspace context.';
    return NextResponse.json(
      { error: 'NO_WORKSPACE', message: msg },
      { status: 503 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: 'INVALID', message: 'Missing record id.' },
      { status: 400 },
    );
  }

  const { data: raw, isForm } = await readBody(request);

  // Strip the recordId / _method form helpers an HTML form might send so they
  // don't get flagged as unknown keys. Same for the bulk-import acknowledgement
  // checkbox that might be re-submitted.
  delete raw.recordId;
  delete raw.id;
  delete raw._method;
  delete raw.action;
  delete raw.acknowledgedVerifiedAgainstSource;

  // Safety-boundary guardrail: reject any inbound forbidden pressure-prediction
  // keys (predictedPressurePsi, recommendedCharge, safeOrUnsafe, …) before any
  // further parsing. The CIP reference center NEVER accepts those keys.
  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    const msg = `Forbidden keys rejected: ${forbidden.join(
      ', ',
    )}. CIP reference rows store published metadata only.`;
    return isForm
      ? redirectBack(request, msg, true)
      : NextResponse.json({ error: 'FORBIDDEN_KEYS', message: msg }, {
          status: 400,
        });
  }

  // Allow-list guardrail: reject any unknown keys (e.g. verificationStatus,
  // verifiedAt, verifiedByEmail, workspaceId, id, createdByEmail). These are
  // internal columns the PATCH endpoint must never let the client write.
  const updatableSet = new Set<string>(CIP_RECORD_UPDATABLE_KEYS);
  const unknown = Object.keys(raw).filter((k) => !updatableSet.has(k));
  if (unknown.length > 0) {
    const msg = `Unknown / read-only fields rejected: ${unknown.join(', ')}.`;
    return isForm
      ? redirectBack(request, msg, true)
      : NextResponse.json({ error: 'INVALID', message: msg }, { status: 400 });
  }

  const parsed = cipRecordUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = `Invalid input: ${issue.path.join('.') || 'form'} — ${issue.message}`;
    return isForm
      ? redirectBack(request, msg, true)
      : NextResponse.json(
          { error: 'INVALID', message: msg, issues: parsed.error.issues },
          { status: 400 },
        );
  }

  try {
    const result = await updateCipRecord(
      ctx.workspaceId,
      id,
      parsed.data,
    );
    if (!result.ok) {
      const msg = 'Reference row not found in this workspace.';
      return isForm
        ? redirectBack(request, msg, true)
        : NextResponse.json({ error: 'NOT_FOUND', message: msg }, {
            status: 404,
          });
    }
    if (isForm) {
      return redirectBack(
        request,
        result.changed
          ? `Updated draft row for ${result.record.cartridgeName}. Verify only after comparing against the cited source.`
          : `No changes saved for ${result.record.cartridgeName}.`,
      );
    }
    return NextResponse.json({ ok: true, record: result.record });
  } catch (e) {
    // Robust to missing DB / table — degrade gracefully.
    const msg = e instanceof Error ? e.message : 'Save failed.';
    return isForm
      ? redirectBack(request, msg, true)
      : NextResponse.json({ error: 'UPDATE_FAILED', message: msg }, {
          status: 500,
        });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return patchHandler(request, params);
}

// Allow HTML <form method="post"> with a hidden _method=PATCH (or just POST)
// to call this endpoint from the admin page without JS.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return patchHandler(request, params);
}
