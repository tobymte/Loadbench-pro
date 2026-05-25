import { NextRequest, NextResponse } from 'next/server';
import { feedbackUpdateInput } from '@/lib/beta/feedback';
import { getAdminContext } from '@/lib/auth/admin';
import { isDatabaseConfigured } from '@/lib/db/safeLoad';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/beta-feedback/[id]
//
// Admin-only: update status and/or admin notes on a feedback issue.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: admin.reason ?? 'Operator-only.' },
      { status: 403 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'NO_DATABASE', message: 'DATABASE_URL is not configured.' },
      { status: 503 },
    );
  }

  const { id } = await params;
  const parsed = feedbackUpdateInput.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (data.status === undefined && data.adminNotes === undefined) {
    return NextResponse.json(
      { error: 'INVALID', message: 'No fields provided.' },
      { status: 400 },
    );
  }

  try {
    const { prisma } = await import('@/lib/db/prisma');
    const row = await prisma.betaFeedbackIssue.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.adminNotes !== undefined
          ? { adminNotes: data.adminNotes }
          : {}),
      },
    });
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'LOOKUP_FAILED',
        message: 'Could not update issue.',
        detail:
          err instanceof Error ? err.message.slice(0, 240) : 'unknown error',
      },
      { status: 500 },
    );
  }
}
