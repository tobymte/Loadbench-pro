import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { createCase } from '@/lib/validation/modelValidationDb';
import { caseCreateSchema } from '@/lib/validation/modelValidation';
import { findForbiddenKeys } from '@/lib/ballistics/modelAdapter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function redirectBack(request: Request, datasetId: string | null, message: string, error = false) {
  const params = new URLSearchParams();
  if (error) params.set('error', message);
  else params.set('ok', message);
  const path = datasetId
    ? `/admin/model-validation/${datasetId}`
    : '/admin/model-validation';
  const url = new URL(path, request.url);
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
    if (typeof v !== 'string') {
      obj[k] = null;
      continue;
    }
    const trimmed = v.trim();
    if (trimmed === '') {
      obj[k] = null;
      continue;
    }
    // Coerce numeric form fields.
    const numericFields = new Set([
      'bulletWeightGr',
      'bulletDiameterIn',
      'chargeGr',
      'caseCapacityGrH2O',
      'barrelLengthIn',
      'cartridgeOalIn',
      'tempF',
      'referenceVelocityFps',
      'referencePressurePsi',
      'observedVelocityFps',
    ]);
    if (numericFields.has(k)) {
      const n = Number(trimmed);
      obj[k] = Number.isFinite(n) ? n : null;
    } else {
      obj[k] = trimmed;
    }
  }
  return obj;
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const ctx = await getWorkspaceContext();
  const raw = await readBody(request);

  // Guardrail before parsing.
  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return redirectBack(
      request,
      typeof raw.datasetId === 'string' ? (raw.datasetId as string) : null,
      `Forbidden keys rejected: ${forbidden.join(', ')}.`,
      true,
    );
  }

  const parsed = caseCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return redirectBack(
      request,
      typeof raw.datasetId === 'string' ? (raw.datasetId as string) : null,
      `Invalid input: ${issue.path.join('.') || 'body'} — ${issue.message}`,
      true,
    );
  }

  try {
    const row = await createCase(ctx.workspaceId, ctx.userId, parsed.data);
    return redirectBack(request, row.datasetId, `Case added: ${row.label}.`);
  } catch (e) {
    return redirectBack(
      request,
      parsed.data.datasetId,
      e instanceof Error ? e.message : 'Unknown error creating case.',
      true,
    );
  }
}
