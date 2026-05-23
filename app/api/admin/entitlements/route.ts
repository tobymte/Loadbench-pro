import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  grantManualEntitlement,
  resolveTargetWorkspace,
  revokeManualEntitlement,
} from '@/lib/billing/manualEntitlement';
import { FEATURE_KEYS } from '@/lib/billing/entitlements';

// Manual entitlement admin endpoint. Accepts an `op` field ("grant" or
// "revoke") and either a workspaceId/slug or an email identifying the target
// workspace. Defaults to the current workspace when no target is provided.
//
// Form-encoded submissions are accepted (so the admin page can use a plain
// <form> without client JS) as well as JSON for programmatic use.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  op?: 'grant' | 'revoke';
  workspaceId?: string;
  email?: string;
  reason?: string;
};

async function readBody(req: Request): Promise<Body> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return (await req.json()) as Body;
    } catch {
      return {};
    }
  }
  const form = await req.formData();
  return {
    op: (form.get('op') as Body['op']) ?? undefined,
    workspaceId: (form.get('workspaceId') as string | null) ?? undefined,
    email: (form.get('email') as string | null) ?? undefined,
    reason: (form.get('reason') as string | null) ?? undefined,
  };
}

function redirectBack(request: Request, message: string, error = false): Response {
  const params = new URLSearchParams();
  if (error) params.set('error', message);
  else params.set('ok', message);
  const url = new URL('/admin/entitlements', request.url);
  url.search = params.toString();
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return NextResponse.json(
      { error: admin.reason ?? 'FORBIDDEN' },
      { status: 403 },
    );
  }

  const body = await readBody(request);
  if (body.op !== 'grant' && body.op !== 'revoke') {
    return NextResponse.json(
      { error: 'op must be "grant" or "revoke".' },
      { status: 400 },
    );
  }

  // Default target = current workspace when neither workspaceId nor email
  // is provided. Lets a solo admin toggle their own access without typing.
  let resolvedWorkspaceId = body.workspaceId?.trim() || null;
  let resolvedEmail = body.email?.trim() || null;
  if (!resolvedWorkspaceId && !resolvedEmail) {
    try {
      const ctx = await getWorkspaceContext();
      resolvedWorkspaceId = ctx.workspaceId;
    } catch {
      return NextResponse.json(
        {
          error:
            'No target specified and no current workspace available. Provide workspaceId or email.',
        },
        { status: 400 },
      );
    }
  }

  const lookup = await resolveTargetWorkspace({
    workspaceId: resolvedWorkspaceId,
    email: resolvedEmail,
  });
  if (lookup.kind === 'error') {
    return NextResponse.json({ error: lookup.message }, { status: 404 });
  }

  // Best-effort admin user id lookup so the AuditEvent can attribute the
  // action to a User row when one exists. In the LOADBENCH_DISABLE_AUTH
  // local-dev path there is no Clerk user, so this stays null.
  let adminUserId: string | null = null;
  try {
    const ctx = await getWorkspaceContext();
    adminUserId = ctx.userId.startsWith('dev-') ? null : ctx.userId;
  } catch {
    adminUserId = null;
  }

  const adminEmail = admin.email ?? 'unknown@loadbench.local';
  const reason = body.reason?.trim() || null;
  const featureKey = FEATURE_KEYS.PRESSURE_MODELING;

  try {
    if (body.op === 'grant') {
      await grantManualEntitlement({
        workspaceId: lookup.workspace.id,
        featureKey,
        adminEmail,
        adminUserId,
        reason,
      });
    } else {
      await revokeManualEntitlement({
        workspaceId: lookup.workspace.id,
        featureKey,
        adminEmail,
        adminUserId,
        reason,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OPERATION_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // For form-submitted requests (default browser POST), redirect back to
  // the admin page with a status banner. For JSON callers, return JSON.
  const wantsJson = (request.headers.get('content-type') ?? '').includes(
    'application/json',
  );
  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      op: body.op,
      workspaceId: lookup.workspace.id,
      workspaceName: lookup.workspace.name,
    });
  }
  const verb = body.op === 'grant' ? 'Granted' : 'Revoked';
  return redirectBack(
    request,
    `${verb} pressure_modeling for "${lookup.workspace.name}".`,
  );
}
