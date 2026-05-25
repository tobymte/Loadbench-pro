// Assisted CIP Source Import — preview endpoint.
//
// POST { url } -> { meta }   (admin-only, JSON)
// The body is JSON for the in-page fetch button. The endpoint does no DB
// writes and never returns chamber-pressure data. It only echoes back
// metadata about the URL the admin pasted.
import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import {
  fetchCipSourceMetadata,
  validateAndNormalizeUrl,
} from '@/lib/validation/cipSourceFetch';
import { findForbiddenKeys } from '@/lib/ballistics/modelAdapter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  // Hard guardrail — reject any inbound forbidden keys before we do
  // anything else. This endpoint is metadata only.
  const forbidden = findForbiddenKeys(body);
  if (forbidden.length > 0) {
    return NextResponse.json(
      {
        error: 'FORBIDDEN_KEYS',
        message: `Forbidden keys rejected: ${forbidden.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  const rawUrl = typeof body.url === 'string' ? body.url : '';
  const validated = validateAndNormalizeUrl(rawUrl);
  if (!validated.ok) {
    return NextResponse.json(
      { error: 'INVALID_URL', message: validated.reason },
      { status: 400 },
    );
  }

  const meta = await fetchCipSourceMetadata(validated.url);
  return NextResponse.json({ meta });
}
