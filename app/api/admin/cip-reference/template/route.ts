import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { buildCipTemplateCsv } from '@/lib/validation/cipReference';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const csv = buildCipTemplateCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="shooters-world-cip-template.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
