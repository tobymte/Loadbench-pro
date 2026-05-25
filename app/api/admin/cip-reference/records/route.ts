import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  cipRecordCreateSchema,
} from '@/lib/validation/cipReference';
import {
  createCipRecord,
  listAllCipRecords,
} from '@/lib/validation/cipReferenceDb';
import { findForbiddenKeys } from '@/lib/ballistics/modelAdapter';

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
  for (const [k, v] of form.entries()) {
    obj[k] = typeof v === 'string' ? v : null;
  }
  return obj;
}

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();
  const ctx = await getWorkspaceContext();
  const rows = await listAllCipRecords(ctx.workspaceId);
  return NextResponse.json({ data: rows });
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

  // Hard guardrail: reject any inbound forbidden keys (predictedPressurePsi,
  // safeOrUnsafe, recommendedCharge, etc.) before further parsing. The CIP
  // reference center never accepts those keys, even transiently.
  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return redirectBack(
      request,
      `Forbidden keys rejected: ${forbidden.join(', ')}. CIP reference rows store published metadata only.`,
      true,
    );
  }

  const parsed = cipRecordCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return redirectBack(
      request,
      `Invalid input: ${issue.path.join('.') || 'form'} — ${issue.message}`,
      true,
    );
  }

  try {
    const row = await createCipRecord(
      ctx.workspaceId,
      admin.email ?? null,
      parsed.data,
    );
    return redirectBack(
      request,
      `Draft reference row saved for ${row.cartridgeName}. Promote to VERIFIED only after comparing against the cited source.`,
    );
  } catch (e) {
    return redirectBack(
      request,
      e instanceof Error ? e.message : 'Save failed.',
      true,
    );
  }
}
