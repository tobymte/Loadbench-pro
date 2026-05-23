// Internal API route the Next.js client calls. It validates user input,
// forwards to the external .NET Ballistics Engine, and returns only
// external-ballistics fields (range, velocity, energy, drop, drift, time,
// MOA/Mil). It never returns pressure, PSI, charge advice, or safety verdicts.

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  ballisticsRequestSchema,
  callBallisticsEngine,
  getEngineUrl,
} from '@/lib/ballistics/engineClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getWorkspaceContext();
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const configured = getEngineUrl() !== null;
  return NextResponse.json({
    configured,
    scope: 'external_ballistics_only',
    description:
      'External / downrange ballistics only. No chamber pressure, no PSI, no load safety verdict, no charge recommendations.',
  });
}

export async function POST(req: NextRequest) {
  try {
    await getWorkspaceContext();
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (getEngineUrl() === null) {
    return NextResponse.json(
      {
        error: 'service_unconfigured',
        message:
          'BALLISTICS_ENGINE_URL is not set. Run the .NET service in services/ballistics-engine (dotnet run) and set BALLISTICS_ENGINE_URL in .env.local.',
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  const parsed = ballisticsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        problems: parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`),
      },
      { status: 400 },
    );
  }

  const result = await callBallisticsEngine(parsed.data, { timeoutMs: 10000 });

  if (!result.ok) {
    const err = result.error;
    switch (err.kind) {
      case 'unconfigured':
        return NextResponse.json(
          { error: 'service_unconfigured', message: 'BALLISTICS_ENGINE_URL is not set.' },
          { status: 503 },
        );
      case 'invalid_request':
        return NextResponse.json(
          { error: 'invalid_request', problems: err.problems },
          { status: 400 },
        );
      case 'engine_error':
        return NextResponse.json(
          {
            error: 'engine_error',
            message: `Ballistics engine returned ${err.status}: ${err.message}`,
          },
          { status: 502 },
        );
      case 'network_error':
        return NextResponse.json(
          {
            error: 'engine_unreachable',
            message: `Could not reach the ballistics engine: ${err.message}`,
          },
          { status: 504 },
        );
    }
  }

  return NextResponse.json({
    data: {
      engine: result.data.engine,
      engineNotice: result.data.engineNotice,
      scopeNotice: result.data.scopeNotice,
      points: result.data.points,
    },
  });
}
