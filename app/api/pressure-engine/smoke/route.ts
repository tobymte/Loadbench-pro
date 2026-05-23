/**
 * In-process smoke check for the pressure-engine forbidden-output guardrails.
 * Calls `smokeCheckForbiddenKeys()` from lib/validation/pressureEngine.ts and
 * returns the pass/fail result. Intended for use by operators after a deploy
 * to confirm the guardrail still recognises every documented forbidden key.
 *
 * This route does not read or write any data and does not require the
 * pressure_modeling entitlement — it's a self-test of the guardrail code.
 */

import { NextResponse } from 'next/server';
import { smokeCheckForbiddenKeys } from '@/lib/validation/pressureEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = smokeCheckForbiddenKeys();
  return NextResponse.json(result, { status: result.passed ? 200 : 500 });
}
