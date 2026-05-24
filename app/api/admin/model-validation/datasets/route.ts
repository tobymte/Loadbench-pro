import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  createDataset,
  listDatasets,
} from '@/lib/validation/modelValidationDb';
import {
  datasetCreateSchema,
  VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE,
} from '@/lib/validation/modelValidation';
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
  const url = new URL('/admin/model-validation', request.url);
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
  // Booleans from checkbox form posts.
  if (obj.acknowledgedValidationOnly === 'on') {
    obj.acknowledgedValidationOnly = true;
  }
  return obj;
}

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();
  const ctx = await getWorkspaceContext();
  const rows = await listDatasets(ctx.workspaceId);
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();

  const ctx = await getWorkspaceContext();
  const raw = await readBody(request);

  // Hard guardrail: reject any inbound forbidden keys before further parsing.
  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return redirectBack(
      request,
      `Forbidden keys rejected: ${forbidden.join(', ')}. Datasets cannot carry pressure predictions or charge advice.`,
      true,
    );
  }

  const parsed = datasetCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return redirectBack(
      request,
      `Invalid input: ${issue.path.join('.') || 'body'} — ${issue.message}`,
      true,
    );
  }
  if (!parsed.data.acknowledgedValidationOnly) {
    return redirectBack(request, VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE, true);
  }

  try {
    const row = await createDataset(ctx.workspaceId, ctx.userId, parsed.data);
    return redirectBack(request, `Dataset created: ${row.name} (${row.id}).`);
  } catch (e) {
    return redirectBack(
      request,
      e instanceof Error ? e.message : 'Unknown error creating dataset.',
      true,
    );
  }
}
