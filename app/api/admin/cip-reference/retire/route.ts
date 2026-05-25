import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { retireCipRecord } from '@/lib/validation/cipReferenceDb';

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

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();
  const ctx = await getWorkspaceContext();
  const form = await request.formData();
  const recordId = form.get('recordId');
  if (typeof recordId !== 'string' || recordId.length === 0) {
    return redirectBack(request, 'Missing recordId.', true);
  }
  const result = await retireCipRecord(ctx.workspaceId, recordId);
  if (!result.ok) {
    return redirectBack(request, 'Reference row not found.', true);
  }
  return redirectBack(
    request,
    `Reference row retired for ${result.record.cartridgeName}.`,
  );
}
