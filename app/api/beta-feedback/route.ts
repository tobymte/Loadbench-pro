import { NextRequest, NextResponse } from 'next/server';
import { feedbackCreateInput } from '@/lib/beta/feedback';
import { isDatabaseConfigured } from '@/lib/db/safeLoad';

export const dynamic = 'force-dynamic';

// POST /api/beta-feedback
//
// Accepts user-submitted feedback. Auth/workspace are looked up best-effort —
// missing workspace context is NOT an error here; we want testers to be able
// to file an issue even if the workspace lookup fails (e.g. their sign-up is
// not yet provisioned). When auth context is available we attach the
// reporter and workspace; otherwise the row is saved with the supplied email.
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: 'NO_DATABASE',
        message:
          'Feedback storage is not configured (DATABASE_URL missing). Ask your operator to finish deployment setup.',
      },
      { status: 503 },
    );
  }

  const parsed = feedbackCreateInput.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  let workspaceId: string | null = null;
  let reporterUserId: string | null = null;
  let reporterEmail: string | null = null;
  let reporterDisplay: string | null = null;

  // Best-effort auth lookup. Failures fall through to anonymous capture.
  try {
    const { getWorkspaceContext } = await import('@/lib/auth/workspace');
    const ctx = await getWorkspaceContext();
    workspaceId = ctx.workspaceId === 'dev-workspace' ? null : ctx.workspaceId;
    reporterUserId = ctx.userId === 'dev-user' ? null : ctx.userId;
    if (reporterUserId) {
      const { prisma } = await import('@/lib/db/prisma');
      const user = await prisma.user.findUnique({
        where: { id: reporterUserId },
        select: { email: true, displayName: true },
      });
      reporterEmail = user?.email ?? null;
      reporterDisplay = user?.displayName ?? null;
    }
  } catch {
    // Unauthenticated — fall back to user-provided email if any.
  }

  if (!reporterEmail && data.reporterEmail) {
    reporterEmail = data.reporterEmail;
  }

  try {
    const { prisma } = await import('@/lib/db/prisma');
    const row = await prisma.betaFeedbackIssue.create({
      data: {
        workspaceId,
        reporterUserId,
        reporterEmail,
        reporterDisplay,
        title: data.title.trim(),
        type: data.type,
        severity: data.severity,
        pageArea: data.pageArea?.trim() || null,
        description: data.description.trim(),
        stepsToReproduce: data.stepsToReproduce?.trim() || null,
        expectedResult: data.expectedResult?.trim() || null,
        actualResult: data.actualResult?.trim() || null,
        deviceBrowser: data.deviceBrowser?.trim() || null,
        contactPreference: data.contactPreference?.trim() || null,
        buildHash: data.buildHash?.trim() || null,
      },
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'LOOKUP_FAILED',
        message:
          'Could not save your feedback right now. The migration may not have been applied yet.',
        detail:
          err instanceof Error ? err.message.slice(0, 240) : 'unknown error',
      },
      { status: 500 },
    );
  }
}

// GET /api/beta-feedback
//
// Returns the recent feedback rows the current authenticated workspace has
// submitted. Best-effort: returns an empty list when the database, the
// workspace, or the table is unavailable.
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ data: [], reason: 'no-database' });
  }

  try {
    const { getWorkspaceContext } = await import('@/lib/auth/workspace');
    const { prisma } = await import('@/lib/db/prisma');
    const ctx = await getWorkspaceContext();
    if (ctx.workspaceId === 'dev-workspace') {
      // Dev fallback workspace — show any rows reporters created without a
      // real workspace association.
      const rows = await prisma.betaFeedbackIssue.findMany({
        where: { workspaceId: null },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      return NextResponse.json({ data: rows });
    }
    const rows = await prisma.betaFeedbackIssue.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ data: [], reason: 'lookup-failed' });
  }
}
