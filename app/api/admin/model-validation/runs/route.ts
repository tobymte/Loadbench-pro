import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { runDatasetValidation } from '@/lib/validation/modelValidationDb';
import {
  runCreateSchema,
  VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE,
} from '@/lib/validation/modelValidation';
import {
  DEFAULT_ADAPTER_NAME,
  findForbiddenKeys,
} from '@/lib/ballistics/modelAdapter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function redirectBack(
  request: Request,
  datasetId: string | null,
  message: string,
  error = false,
  runId?: string,
) {
  const params = new URLSearchParams();
  if (error) params.set('error', message);
  else params.set('ok', message);
  if (runId) params.set('runId', runId);
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
    obj[k] = typeof v === 'string' ? v : null;
  }
  if (obj.acknowledgedValidationOnly === 'on') {
    obj.acknowledgedValidationOnly = true;
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

  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return redirectBack(
      request,
      typeof raw.datasetId === 'string' ? (raw.datasetId as string) : null,
      `Forbidden keys rejected: ${forbidden.join(', ')}.`,
      true,
    );
  }

  // Default adapter name when none supplied — the disabled default.
  if (!raw.adapterName) raw.adapterName = DEFAULT_ADAPTER_NAME;

  const parsed = runCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return redirectBack(
      request,
      typeof raw.datasetId === 'string' ? (raw.datasetId as string) : null,
      `Invalid input: ${issue.path.join('.') || 'body'} — ${issue.message}`,
      true,
    );
  }
  if (!parsed.data.acknowledgedValidationOnly) {
    return redirectBack(
      request,
      parsed.data.datasetId,
      VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE,
      true,
    );
  }

  try {
    const { runId } = await runDatasetValidation({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      datasetId: parsed.data.datasetId,
      adapterName: parsed.data.adapterName,
      modelVersionId: parsed.data.modelVersionId,
      notes: parsed.data.notes,
    });
    return redirectBack(
      request,
      parsed.data.datasetId,
      `Run completed (non-operational): ${runId}.`,
      false,
      runId,
    );
  } catch (e) {
    return redirectBack(
      request,
      parsed.data.datasetId,
      e instanceof Error ? e.message : 'Unknown error running harness.',
      true,
    );
  }
}
