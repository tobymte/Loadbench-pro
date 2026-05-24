import { NextResponse } from 'next/server';
import { probeEngineHealth } from '@/lib/ballistics/engineClient';

// Lightweight ballistics-engine health probe. Public-equivalent endpoint —
// reveals only whether the engine is configured/reachable and which engine
// implementation responded. Never exposes URLs, headers, or secrets.

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await probeEngineHealth({ timeoutMs: 3000 });
  if (result.kind === 'unconfigured') {
    return NextResponse.json(
      { configured: false, ok: false, reason: 'BALLISTICS_ENGINE_URL is unset' },
      { status: 503 },
    );
  }
  if (result.kind === 'error') {
    return NextResponse.json(
      {
        configured: true,
        ok: false,
        status: result.status ?? null,
        message: result.message,
        latencyMs: result.latencyMs,
      },
      { status: 502 },
    );
  }
  return NextResponse.json({
    configured: true,
    ok: true,
    engine: result.engine,
    notice: result.notice,
    latencyMs: result.latencyMs,
  });
}
