import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseChronoCsv, summarizeChrono } from '@/lib/analysis/chrono';
import { isDatabaseConfigured } from '@/lib/db/safeLoad';

export const dynamic = 'force-dynamic';

const importInput = z.object({
  csv: z.string().min(1).max(200_000),
  loadId: z.string().min(1),
  rifleId: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  location: z.string().max(240).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: 'NO_DATABASE',
        message:
          'Saving a chronograph session requires a database. Set DATABASE_URL in .env.local and run prisma migrate deploy.',
      },
      { status: 503 },
    );
  }

  let prisma: typeof import('@/lib/db/prisma').prisma;
  let getWorkspaceContext: typeof import('@/lib/auth/workspace').getWorkspaceContext;
  let assertCanWrite: typeof import('@/lib/auth/workspace').assertCanWrite;
  try {
    ({ prisma } = await import('@/lib/db/prisma'));
    ({ getWorkspaceContext, assertCanWrite } = await import(
      '@/lib/auth/workspace'
    ));
  } catch {
    return NextResponse.json(
      {
        error: 'DATABASE_UNAVAILABLE',
        message: 'Could not initialise the database client.',
      },
      { status: 503 },
    );
  }

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNAUTHENTICATED')) {
      return NextResponse.json(
        { error: 'UNAUTHENTICATED', message: 'Sign in to import a session.' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        error: 'DATABASE_UNAVAILABLE',
        message: 'Workspace lookup failed. Is the database reachable?',
      },
      { status: 503 },
    );
  }

  try {
    assertCanWrite(ctx);
  } catch {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Viewers cannot import sessions.' },
      { status: 403 },
    );
  }

  const parsed = importInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const load = await prisma.load.findFirst({
      where: { id: data.loadId, workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
    });
    if (!load) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['loadId'],
              code: 'INVALID_REF',
              message: 'Load not found in this workspace.',
            },
          ],
        },
        { status: 400 },
      );
    }

    if (data.rifleId) {
      const rifle = await prisma.rifle.findFirst({
        where: { id: data.rifleId, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!rifle) {
        return NextResponse.json(
          {
            error: 'INVALID',
            issues: [
              {
                path: ['rifleId'],
                code: 'INVALID_REF',
                message: 'Rifle not found in this workspace.',
              },
            ],
          },
          { status: 400 },
        );
      }
    }

    let date: Date = new Date();
    if (data.date) {
      const parsedDate = new Date(data.date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          {
            error: 'INVALID',
            issues: [
              {
                path: ['date'],
                code: 'INVALID_SHAPE',
                message: 'Invalid date.',
              },
            ],
          },
          { status: 400 },
        );
      }
      date = parsedDate;
    }

    const parseResult = parseChronoCsv(data.csv);
    if (parseResult.shots.length === 0) {
      return NextResponse.json(
        {
          error: 'INVALID',
          issues: [
            {
              path: ['csv'],
              code: 'NO_SHOTS',
              message: 'No valid velocity rows were parsed from the CSV.',
            },
          ],
        },
        { status: 400 },
      );
    }

    const summary = summarizeChrono(parseResult.shots);

    const importNoteLines = [
      `Imported from chronograph CSV (${parseResult.shots.length} shots${
        parseResult.invalid.length > 0
          ? `, ${parseResult.invalid.length} invalid rows skipped`
          : ''
      }).`,
    ];
    if (summary.minFps != null && summary.maxFps != null) {
      importNoteLines.push(
        `Range: ${summary.minFps}–${summary.maxFps} fps. ES ${summary.esFps ?? '—'}, SD ${summary.sdFps ?? '—'}.`,
      );
    }
    if (data.notes) {
      importNoteLines.push(data.notes);
    }

    const row = await prisma.rangeSession.create({
      data: {
        workspaceId: ctx.workspaceId,
        loadId: load.id,
        rifleId: data.rifleId || null,
        date,
        location: data.location ?? null,
        shotsFired: summary.count,
        avgVelocityFps: summary.avgVelocityFps,
        esFps: summary.esFps,
        sdFps: summary.sdFps,
        notes: importNoteLines.join('\n'),
      },
    });

    return NextResponse.json(
      {
        sessionId: row.id,
        summary,
        shotCount: parseResult.shots.length,
        invalidRows: parseResult.invalid.length,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        error: 'DATABASE_UNAVAILABLE',
        message:
          'Could not save the chronograph session. The database may be unreachable or the schema may be out of date.',
      },
      { status: 503 },
    );
  }
}
