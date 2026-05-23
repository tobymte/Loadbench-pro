import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
} from '@/lib/auth/workspace';
import { parseChronoCsv, summarizeChrono } from '@/lib/analysis/chrono';

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
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = importInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

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
}
