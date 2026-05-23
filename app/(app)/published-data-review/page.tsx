import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  HornadySetupButton,
  VerifyRowControl,
  CreateLoadDraftFromRow,
} from '@/components/forms/PublishedDataReviewActions';
import { PublishedLoadRowDraftForm } from '@/components/forms/PublishedLoadRowDraftForm';
import { BatchPublishedRowEntry } from '@/components/forms/BatchPublishedRowEntry';

export const dynamic = 'force-dynamic';

// Published-data review/staging surface.
// Rows on this page are NOT operational loads, NOT recommendations, and NOT
// presented as safe/unsafe. They are user-transcribed values from manufacturer
// or other published references, staged for verification against the original
// document before any downstream use as a citation on a Load record.

type RowStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';

const STATUS_LABEL: Record<RowStatus, string> = {
  DRAFT: 'Draft',
  NEEDS_REVIEW: 'Needs review',
  VERIFIED: 'Verified by user',
  REJECTED: 'Rejected',
};

function statusTone(
  s: RowStatus,
): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'NEEDS_REVIEW':
      return 'warning';
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
      return 'danger';
  }
}

export default async function PublishedDataReviewPage() {
  const ctx = await getWorkspaceContext();

  const [imports, rows, cartridges, bullets, powders, sources] = await Promise.all([
    prisma.publishedDataImport.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        source: { select: { id: true, title: true } },
        _count: { select: { rows: true } },
      },
    }),
    prisma.publishedLoadRowDraft.findMany({
      // Rejected rows are hidden from the active review list. They are
      // preserved in the database for audit/history but no longer appear
      // here once a workspace member rejects them.
      where: { workspaceId: ctx.workspaceId, status: { not: 'REJECTED' } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      include: {
        import: { select: { id: true, title: true } },
        source: { select: { id: true, title: true, publishedMaxGr: true } },
      },
    }),
    prisma.cartridge.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.component.findMany({
      where: { workspaceId: ctx.workspaceId, kind: 'BULLET' },
      orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
      select: { id: true, manufacturer: true, model: true },
    }),
    prisma.component.findMany({
      where: { workspaceId: ctx.workspaceId, kind: 'POWDER' },
      orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
      select: { id: true, manufacturer: true, model: true },
    }),
    prisma.source.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <Topbar
        title="Published-data review"
        actions={<Badge tone="warning">User verification required</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <div
          className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text"
          data-testid="published-review-notice"
        >
          <strong className="font-semibold">
            Manual entries are transcriptions. Verify against the original
            source before creating a load draft.
          </strong>{' '}
          Copyrighted and safety-critical published data (e.g. manufacturer
          powder-charge tables) is never auto-imported into this app as
          authoritative load data. Rows on this page are not recommendations
          and are not labelled safe or unsafe. Verify each row against the
          original document before citing it on a load — and even then, a
          charge-bearing{' '}
          <Link href="/loads" className="text-accent hover:text-accent-hover">
            Load
          </Link>{' '}
          still requires its normal source citation and safety acknowledgement.
          See the{' '}
          <Link href="/safety" className="text-accent hover:text-accent-hover">
            safety policy
          </Link>
          .
        </div>

        <Card>
          <CardHeader
            title="Hornady 6mm ARC Gas Gun data sheet"
            description="Stage a non-authoritative review set for the Hornady 6mm ARC Gas Gun data sheet. Creates source, cartridge, test rifle, bullet, case, primer, and powder-name metadata only. Does NOT create powder-charge rows — transcribe and verify those yourself."
          />
          <CardBody>
            <HornadySetupButton />
            <p className="text-[11px] text-text-faint mt-3 leading-relaxed">
              The setup action seeds only descriptive metadata cited from the
              data sheet (bullet identities and BCs, case/primer identity,
              cartridge dimensions, max pressure / COL / case-length limits as
              recorded by the publisher, and the names of powders listed as
              options). It does not seed any charge weights, velocities, or
              max-load markers. Those belong on user-verified row drafts.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Stage a row for review"
            description="Transcribe a single row from a published reference for later verification. Charge / velocity values are stored as drafts, not as recommended loads."
          />
          <CardBody>
            <PublishedLoadRowDraftForm
              imports={imports.map((i) => ({ id: i.id, title: i.title }))}
              cartridges={cartridges.map((c) => ({ id: c.id, label: c.name }))}
              bullets={bullets.map((b) => ({
                id: b.id,
                label: `${b.manufacturer} ${b.model}`,
              }))}
              powders={powders.map((p) => ({
                id: p.id,
                label: `${p.manufacturer} ${p.model}`,
              }))}
              sources={sources.map((s) => ({ id: s.id, label: s.title }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Batch row entry"
            description="Paste multiple rows from a published reference (CSV or TSV). Preview validates each row; staging creates draft rows under the chosen review set. Rows are never marked verified here."
          />
          <CardBody>
            <BatchPublishedRowEntry
              imports={imports.map((i) => ({ id: i.id, title: i.title }))}
              cartridges={cartridges.map((c) => ({ id: c.id, label: c.name }))}
              bullets={bullets.map((b) => ({
                id: b.id,
                manufacturer: b.manufacturer,
                model: b.model,
              }))}
              powders={powders.map((p) => ({
                id: p.id,
                manufacturer: p.manufacturer,
                model: p.model,
              }))}
              sources={sources.map((s) => ({ id: s.id, label: s.title }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Review sets"
            description="Containers that group staged rows under a single published source."
          />
          {imports.length === 0 ? (
            <CardBody>
              <p
                className="text-[12px] text-text-muted"
                data-testid="published-imports-empty"
              >
                No review sets yet. Stage one above to begin.
              </p>
            </CardBody>
          ) : (
            <table data-testid="published-imports-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Publisher</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th className="text-right">Rows</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id} data-testid={`published-import-${i.id}`}>
                    <td>{i.title}</td>
                    <td>{i.publisher ?? '—'}</td>
                    <td>{i.source ? i.source.title : '—'}</td>
                    <td>
                      <Badge tone="neutral">{i.status}</Badge>
                    </td>
                    <td className="text-right">{i._count.rows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Staged rows"
            description="Drafts, pending verifications, and verified rows. Rejected rows are removed from this list (kept in the database for audit). Verifying a row only marks it as user-reviewed; it does not create a Load."
          />
          {rows.length === 0 ? (
            <CardBody>
              <p
                className="text-[12px] text-text-muted"
                data-testid="published-rows-empty"
              >
                No staged rows yet.
              </p>
            </CardBody>
          ) : (
            <table data-testid="published-rows-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Set</th>
                  <th>Page</th>
                  <th>Source</th>
                  <th>Bullet</th>
                  <th>Powder</th>
                  <th className="text-right">Charge (gr)</th>
                  <th className="text-right">Row max (gr)</th>
                  <th className="text-right">Velocity (fps)</th>
                  <th>Max?</th>
                  <th>Verified</th>
                  <th>Actions</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = r.status as RowStatus;
                  const bullet =
                    r.bulletName ??
                    (r.bulletWeightGr != null
                      ? `${r.bulletWeightGr} gr`
                      : '—');
                  const powder = r.powderName ?? '—';
                  return (
                    <tr
                      key={r.id}
                      data-testid={`published-row-${r.id}`}
                    >
                      <td>
                        <Badge tone={statusTone(status)}>
                          {STATUS_LABEL[status]}
                        </Badge>
                      </td>
                      <td>{r.import.title}</td>
                      <td data-testid={`published-row-${r.id}-page`}>
                        {r.pageLabel ?? '—'}
                      </td>
                      <td>{r.source?.title ?? '—'}</td>
                      <td>{bullet}</td>
                      <td>{powder}</td>
                      <td className="text-right">
                        {r.chargeGr != null ? r.chargeGr : '—'}
                      </td>
                      <td
                        className="text-right"
                        data-testid={`published-row-${r.id}-rowmax`}
                      >
                        {r.publishedMaxChargeGr != null
                          ? r.publishedMaxChargeGr
                          : r.isMaxLoad && r.chargeGr != null
                            ? `${r.chargeGr} *`
                            : '—'}
                      </td>
                      <td className="text-right">
                        {r.velocityFps != null ? r.velocityFps : '—'}
                      </td>
                      <td>{r.isMaxLoad ? 'max' : '—'}</td>
                      <td>
                        {r.verifiedAt
                          ? new Date(r.verifiedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <VerifyRowControl id={r.id} status={status} />
                      </td>
                      <td>
                        {status === 'VERIFIED' ? (
                          <CreateLoadDraftFromRow
                            id={r.id}
                            hasCartridge={r.cartridgeId != null}
                            hasBullet={r.bulletComponentId != null}
                            hasPowder={r.powderComponentId != null}
                            hasSource={r.sourceId != null}
                            hasCharge={r.chargeGr != null}
                            rowPublishedMaxChargeGr={r.publishedMaxChargeGr ?? null}
                            rowChargeGr={r.chargeGr ?? null}
                            isMaxLoad={r.isMaxLoad}
                            sourcePublishedMaxGr={
                              r.source?.publishedMaxGr ?? null
                            }
                          />
                        ) : (
                          <span
                            className="text-[11px] text-text-faint"
                            data-testid={`published-row-${r.id}-create-load-disabled`}
                            title="Only user-verified source rows can be used to create a load draft."
                          >
                            Verify first
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {rows.length > 0 && (
            <CardBody>
              <p
                className="text-[11px] text-text-faint leading-relaxed"
                data-testid="published-rows-rowmax-legend"
              >
                A <em>Row max</em> value shown with a trailing <code>*</code>
                {' '}means the row is marked maximum in the source and no
                separate published max was transcribed — the row charge is
                treated as the row maximum after verification. Row max is the
                value the load-draft validator checks against; it is
                independent of the Source-wide max.
              </p>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              Published-data review records are stored as user-entered draft
              transcriptions. LoadBench Pro does not compute pressure, predict
              velocity, recommend a charge, or label any row as safe or unsafe.
              Verification on this page only flags that a workspace member has
              reviewed the transcription against the original published
              document. To use a verified row on a charge-bearing Load, open
              the Loads form and cite the original Source — the existing
              safety-acknowledgement validation still applies.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
