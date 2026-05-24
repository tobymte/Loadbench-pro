import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  assertCanWrite,
  getWorkspaceContext,
} from '@/lib/auth/workspace';
import { createLoadDraftFromRowSchema } from '@/lib/validation/publishedDataReview';
import { validateLoad } from '@/lib/validation/load';

export const dynamic = 'force-dynamic';

// POST /api/published-data-review/rows/[id]/create-load-draft
//
// Creates a Load DRAFT from a VERIFIED PublishedLoadRowDraft. This route does
// NOT weaken the existing load safety validator in lib/validation/load.ts —
// it composes a payload from the row and runs validateLoad() against the
// row-specific published maximum (preferred) or the cited Source's
// publishedMaxGr (fallback). If validation fails (e.g. neither the row nor
// the Source has a published max recorded, or the row's chargeGr exceeds
// the chosen max), no Load is created and the validator's issues are
// returned verbatim.
//
// Safety guardrails enforced here:
//   - Row must be VERIFIED (transcribed AND user-verified against the original).
//   - Caller must explicitly set safetyAcknowledged: true on this request — we
//     never auto-inherit acknowledgement from row verification.
//   - Row must have a workspace-scoped cartridge + bullet + powder component;
//     free-text labels alone are not enough to materialize a Load.
//   - Row must have a workspace-scoped sourceId so the cited Source feeds
//     validateLoad() for charge-vs-publishedMax checking.
//   - Row must record a row-specific published max if chargeGr is present,
//     UNLESS the row itself is flagged maximum (isMaxLoad) and chargeGr ==
//     publishedMaxChargeGr (in which case the row charge is the row max).
//     If no row-specific max is recorded, the cited Source must have a
//     publishedMaxGr so the canonical validator can enforce a ceiling.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getWorkspaceContext();
  assertCanWrite(ctx);

  const parsed = createLoadDraftFromRowSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const row = await prisma.publishedLoadRowDraft.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      source: { select: { id: true, title: true, publishedMaxGr: true } },
      import: { select: { id: true, title: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // PublishedLoadRowDraft has cartridgeId but no Prisma `cartridge` relation —
  // fetch the cartridge separately, scoped to the workspace.
  const cartridge = row.cartridgeId
    ? await prisma.cartridge.findFirst({
        where: { id: row.cartridgeId, workspaceId: ctx.workspaceId },
        select: { id: true, name: true },
      })
    : null;

  if (row.status !== 'VERIFIED') {
    return NextResponse.json(
      {
        error: 'INVALID',
        issues: [
          {
            path: ['status'],
            code: 'ROW_NOT_VERIFIED',
            message:
              'Only rows the user has verified against the original source can be used to create a load draft.',
          },
        ],
      },
      { status: 400 },
    );
  }

  const missing: Array<{ path: string[]; code: string; message: string }> = [];
  if (!row.cartridgeId)
    missing.push({
      path: ['cartridgeId'],
      code: 'ROW_MISSING_CARTRIDGE',
      message:
        'Row has no workspace cartridge linked. Edit the row and select a cartridge before creating a load draft.',
    });
  if (!row.bulletComponentId)
    missing.push({
      path: ['bulletComponentId'],
      code: 'ROW_MISSING_BULLET',
      message:
        'Row has no workspace bullet component linked. A free-text bullet label is not enough — select a bullet component on the row before creating a load draft.',
    });
  if (!row.powderComponentId)
    missing.push({
      path: ['powderComponentId'],
      code: 'ROW_MISSING_POWDER',
      message:
        'Row has no workspace powder component linked. A free-text powder label is not enough — select a powder component on the row before creating a load draft.',
    });
  if (!row.sourceId)
    missing.push({
      path: ['sourceId'],
      code: 'ROW_MISSING_SOURCE',
      message:
        'Row has no cited Source. The load validator requires a Source for any charge-bearing load.',
    });
  if (row.chargeGr == null)
    missing.push({
      path: ['chargeGr'],
      code: 'ROW_MISSING_CHARGE',
      message:
        'Row has no charge weight transcribed; nothing to seed a load draft with.',
    });
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'INVALID', issues: missing },
      { status: 400 },
    );
  }

  // At this point all required references are non-null; narrow them for TS.
  const cartridgeId = row.cartridgeId!;
  const bulletId = row.bulletComponentId!;
  const powderId = row.powderComponentId!;
  const sourceId = row.sourceId!;
  const chargeGr = row.chargeGr!;

  // Resolve the published max we will validate against:
  //  - Prefer the row-specific publishedMaxChargeGr recorded on the row.
  //  - If the row is flagged isMaxLoad and has no separate max recorded,
  //    treat the row's charge as the row-specific maximum (i.e. this row IS
  //    the max). This matches the manual-entry UI affordance.
  //  - Otherwise leave it unset and fall back to Source.publishedMaxGr,
  //    which validateLoad will require (SOURCE_MISSING_PUBLISHED_MAX if
  //    absent).
  let effectiveRowMax: number | null = row.publishedMaxChargeGr ?? null;
  if (effectiveRowMax == null && row.isMaxLoad) {
    effectiveRowMax = chargeGr;
  }

  if (effectiveRowMax == null && row.source?.publishedMaxGr == null) {
    return NextResponse.json(
      {
        error: 'INVALID',
        issues: [
          {
            path: ['publishedMaxChargeGr'],
            code: 'ROW_MISSING_PUBLISHED_MAX',
            message:
              'Row has no row-specific published maximum recorded, the row is not flagged maximum, and the cited Source has no published max. Record a row-specific published max (or mark the row maximum, or set the Source published max) before creating a load draft.',
          },
        ],
      },
      { status: 400 },
    );
  }

  const name =
    (body.name && body.name.trim()) ||
    [
      cartridge?.name,
      row.bulletName ??
        (row.bulletWeightGr != null ? `${row.bulletWeightGr}gr` : null),
      row.powderName,
      'verified row',
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 120) ||
    'Load draft from verified row';

  const citationBits = [
    row.source?.title ? `Source: ${row.source.title}` : null,
    row.import?.title ? `Set: ${row.import.title}` : null,
    row.pageLabel ? `Page: ${row.pageLabel}` : null,
    effectiveRowMax != null
      ? `Row published max: ${effectiveRowMax} gr`
      : null,
  ].filter(Boolean);
  const provenanceLine = `Created from verified published row draft (id ${row.id}).${
    citationBits.length ? ' ' + citationBits.join(' | ') + '.' : ''
  } Values were transcribed by a workspace member and verified against the original published document; they are not recommendations.`;
  const notes = body.notes
    ? `${body.notes.trim()}\n\n${provenanceLine}`
    : provenanceLine;

  const loadPayload = {
    name,
    status: 'DRAFT' as const,
    cartridgeId,
    bulletId,
    powderId,
    sourceId,
    chargeGr,
    cartridgeOalIn: row.colIn ?? undefined,
    publishedMaxChargeGr: effectiveRowMax ?? undefined,
    publishedDataRowId: row.id,
    sourcePageLabel: row.pageLabel ?? undefined,
    safetyAcknowledged: body.safetyAcknowledged,
    notes,
  };

  // Run the canonical load validator. When a row-specific max is supplied,
  // validateLoad enforces the ceiling against that value; otherwise it falls
  // back to the cited Source's publishedMaxGr.
  const result = validateLoad(loadPayload, {
    id: row.source!.id,
    publishedMaxGr: row.source!.publishedMaxGr,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: 'INVALID', issues: result.issues },
      { status: 400 },
    );
  }

  const data = result.data;
  const created = await prisma.load.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      updatedById: ctx.userId,
      name: data.name,
      status: data.status,
      cartridgeId: data.cartridgeId,
      bulletId: data.bulletId,
      powderId: data.powderId,
      sourceId: data.sourceId ?? null,
      chargeGr: data.chargeGr ?? null,
      cartridgeOalIn: data.cartridgeOalIn ?? null,
      publishedMaxChargeGr: data.publishedMaxChargeGr ?? null,
      publishedDataRowId: data.publishedDataRowId ?? null,
      sourcePageLabel: data.sourcePageLabel ?? null,
      safetyAcknowledged: data.safetyAcknowledged,
      notes: data.notes ?? null,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(
    { id: created.id, name: created.name, rowId: row.id },
    { status: 201 },
  );
}
