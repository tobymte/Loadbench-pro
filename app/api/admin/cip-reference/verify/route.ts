import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { cipRecordVerifySchema } from '@/lib/validation/cipReference';
import {
  updateCipRecord,
  verifyCipRecord,
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
  const form = await req.formData();
  const obj: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    obj[k] = typeof v === 'string' ? v : null;
  }
  if (obj.acknowledgedVerifiedAgainstSource === 'on') {
    obj.acknowledgedVerifiedAgainstSource = true;
  }
  return obj;
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();

  const ctx = await getWorkspaceContext();
  const raw = await readBody(request);
  const parsed = cipRecordVerifySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.join('.') || 'form';
    return redirectBack(
      request,
      `Cannot verify (${where}): ${issue.message}`,
      true,
    );
  }

  // One-step "save and verify": if the operator typed an inline sourceUrl into
  // the verify form, persist it via the PATCH helper before promoting the row.
  // Saving never auto-verifies — verification still requires the explicit
  // acknowledgement that the parser already enforced above.
  if (parsed.data.sourceUrl) {
    try {
      const save = await updateCipRecord(
        ctx.workspaceId,
        parsed.data.recordId,
        { sourceUrl: parsed.data.sourceUrl },
      );
      if (!save.ok) {
        return redirectBack(
          request,
          'Reference row not found in this workspace.',
          true,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed.';
      return redirectBack(
        request,
        `Could not save sourceUrl before verifying: ${msg}`,
        true,
      );
    }
  }

  const result = await verifyCipRecord(
    ctx.workspaceId,
    parsed.data.recordId,
    admin.email ?? null,
  );
  if (!result.ok) {
    const msg =
      result.reason === 'NOT_FOUND'
        ? 'Reference row not found in this workspace.'
        : 'Cannot verify a row with no source URL. Enter the source URL in the editor and save the draft (or use the inline source URL field on the verify form), then verify.';
    return redirectBack(request, msg, true);
  }
  return redirectBack(
    request,
    `Reference row VERIFIED for ${result.record.cartridgeName}. Pressure prediction remains disabled.`,
  );
}
