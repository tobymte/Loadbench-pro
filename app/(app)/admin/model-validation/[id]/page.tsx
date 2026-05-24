import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import { getDataset } from '@/lib/validation/modelValidationDb';
import {
  DEFAULT_ADAPTER_NAME,
  listAdapters,
} from '@/lib/ballistics/modelAdapter';
import { VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE } from '@/lib/validation/modelValidation';

export const dynamic = 'force-dynamic';

type SearchParams = { ok?: string; error?: string; runId?: string };

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error.';
  }
}

export default async function AdminModelValidationDatasetPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return (
      <>
        <Topbar
          title="Admin · Model validation"
          actions={<Badge tone="danger">Unauthorized</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <Card>
            <CardHeader title="Admin access required" />
            <CardBody>
              <p className="text-[13px] text-text-muted">
                {admin.reason ?? 'You are not authorized to view this page.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>>;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return (
      <>
        <Topbar
          title="Admin · Model validation"
          actions={<Badge tone="warning">Setup required</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text">
            {describeError(e)}
          </div>
        </div>
      </>
    );
  }

  let dataset: Awaited<ReturnType<typeof getDataset>> = null;
  try {
    dataset = await getDataset(ctx.workspaceId, params.id);
  } catch (e) {
    return (
      <>
        <Topbar
          title="Admin · Model validation"
          actions={<Badge tone="warning">Setup required</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text">
            {describeError(e)}
          </div>
        </div>
      </>
    );
  }

  if (!dataset) {
    return (
      <>
        <Topbar
          title="Admin · Model validation"
          actions={<Badge tone="neutral">Not found</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
          <Card>
            <CardHeader
              title="Dataset not found"
              description="No validation dataset matches this id in the current workspace."
            />
            <CardBody>
              <Link
                href="/admin/model-validation"
                className="text-accent hover:text-accent-hover text-[13px]"
              >
                ← Back to dataset list
              </Link>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  const adapters = listAdapters();

  return (
    <>
      <Topbar
        title={`Admin · ${dataset.name}`}
        actions={<Badge tone="accent">Validation dataset</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Breadcrumbs
          items={[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/admin/model-validation', label: 'Model validation' },
            { label: dataset.name },
          ]}
        />

        {searchParams.ok && (
          <div className="rounded-md border border-success/40 bg-success-subtle px-4 py-3 text-[13px] text-text">
            {searchParams.ok}
            {searchParams.runId && (
              <>
                {' '}
                <Link
                  href={`#run-${searchParams.runId}`}
                  className="text-accent hover:text-accent-hover"
                >
                  Jump to run →
                </Link>
              </>
            )}
          </div>
        )}
        {searchParams.error && (
          <div className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-3 text-[13px] text-text">
            {searchParams.error}
          </div>
        )}

        <div className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-[13px] text-text">
          <strong className="font-semibold">
            Pressure prediction is disabled.
          </strong>{' '}
          Reference pressure (when present on a case row) is admin-only
          metadata transcribed from the source — it is never rendered as load
          guidance. Every run row records{' '}
          <code className="text-accent">pressurePredictionStatus: &quot;disabled&quot;</code>.
        </div>

        <Card data-testid="dataset-meta-card">
          <CardHeader
            title="Dataset metadata"
            description={`Kind: ${dataset.kind} · Status: ${dataset.status}`}
          />
          <CardBody>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
              <div>
                <dt className="text-text-faint">Reference identifier</dt>
                <dd className="text-text">
                  {dataset.referenceIdentifier ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-text-faint">License note</dt>
                <dd className="text-text whitespace-pre-line">
                  {dataset.licenseNote ?? '—'}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-text-faint">Description</dt>
                <dd className="text-text whitespace-pre-line">
                  {dataset.description ?? '—'}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card data-testid="add-case-card">
          <CardHeader
            title="Add validation case"
            description="One reference row transcribed from the source. Pressure value (if any) is admin-only validation metadata."
          />
          <CardBody>
            <form
              method="post"
              action="/api/admin/model-validation/cases"
              className="space-y-3"
              data-testid="add-case-form"
            >
              <input type="hidden" name="datasetId" value={dataset.id} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Label</span>
                  <input
                    name="label"
                    type="text"
                    required
                    placeholder="e.g. 140gr ELD-M / H4350 41.5gr"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Cartridge name</span>
                  <input
                    name="cartridgeName"
                    type="text"
                    placeholder="e.g. 6.5 Creedmoor"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Bullet weight (gr)</span>
                  <input
                    name="bulletWeightGr"
                    type="number"
                    step="0.1"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Bullet diameter (in)</span>
                  <input
                    name="bulletDiameterIn"
                    type="number"
                    step="0.001"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Charge (gr)</span>
                  <input
                    name="chargeGr"
                    type="number"
                    step="0.1"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Case capacity (gr H₂O)</span>
                  <input
                    name="caseCapacityGrH2O"
                    type="number"
                    step="0.1"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Barrel length (in)</span>
                  <input
                    name="barrelLengthIn"
                    type="number"
                    step="0.1"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Twist rate</span>
                  <input
                    name="twistRate"
                    type="text"
                    placeholder="e.g. 1:8"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Cartridge OAL (in)</span>
                  <input
                    name="cartridgeOalIn"
                    type="number"
                    step="0.001"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Powder (burn rate label)</span>
                  <input
                    name="powderBurnRateLabel"
                    type="text"
                    placeholder="e.g. H4350"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Temperature (°F)</span>
                  <input
                    name="tempF"
                    type="number"
                    step="0.1"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Reference velocity (fps)</span>
                  <input
                    name="referenceVelocityFps"
                    type="number"
                    step="1"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>
                    Reference pressure (psi){' '}
                    <span className="text-text-faint">— admin-only metadata</span>
                  </span>
                  <input
                    name="referencePressurePsi"
                    type="number"
                    step="1"
                    placeholder="(optional, validation reference only)"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Observed velocity (fps)</span>
                  <input
                    name="observedVelocityFps"
                    type="number"
                    step="1"
                    placeholder="(optional, e.g. lab-measured)"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                  <span>Page / row label</span>
                  <input
                    name="pageLabel"
                    type="text"
                    placeholder="e.g. p.142 row 3"
                    className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Notes</span>
                <textarea
                  name="notes"
                  rows={2}
                  className="px-2 py-1 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <Button type="submit">Add case</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card data-testid="cases-list-card">
          <CardHeader
            title={`Cases (${dataset.cases.length})`}
            description="Reference rows in this dataset. Pressure column shown for admin reference only."
          />
          <CardBody>
            {dataset.cases.length === 0 ? (
              <p className="text-[12px] text-text-muted">No cases yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Label</th>
                      <th className="py-1 pr-3 font-medium">Cartridge</th>
                      <th className="py-1 pr-3 font-medium">Bullet (gr)</th>
                      <th className="py-1 pr-3 font-medium">Powder</th>
                      <th className="py-1 pr-3 font-medium">Charge (gr)</th>
                      <th className="py-1 pr-3 font-medium">Ref vel (fps)</th>
                      <th className="py-1 pr-3 font-medium">Obs vel (fps)</th>
                      <th className="py-1 pr-3 font-medium">
                        Ref PSI{' '}
                        <span className="text-[10px] normal-case text-text-faint">
                          (admin-only)
                        </span>
                      </th>
                      <th className="py-1 pr-3 font-medium">Page</th>
                    </tr>
                  </thead>
                  <tbody className="text-text">
                    {dataset.cases.map((c) => (
                      <tr key={c.id} className="border-t border-border align-top">
                        <td className="py-1.5 pr-3">{c.label}</td>
                        <td className="py-1.5 pr-3">{c.cartridgeName ?? '—'}</td>
                        <td className="py-1.5 pr-3">{c.bulletWeightGr ?? '—'}</td>
                        <td className="py-1.5 pr-3">{c.powderBurnRateLabel ?? '—'}</td>
                        <td className="py-1.5 pr-3">{c.chargeGr ?? '—'}</td>
                        <td className="py-1.5 pr-3">{c.referenceVelocityFps ?? '—'}</td>
                        <td className="py-1.5 pr-3">{c.observedVelocityFps ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-text-muted">{c.referencePressurePsi ?? '—'}</td>
                        <td className="py-1.5 pr-3 text-text-muted">{c.pageLabel ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card data-testid="run-harness-card">
          <CardHeader
            title="Run validation harness"
            description="Compares the adapter response for each case to its reference velocity. The default adapter returns disabled status — no pressure output is produced."
            actions={<Badge tone="warning">Non-operational</Badge>}
          />
          <CardBody>
            <form
              method="post"
              action="/api/admin/model-validation/runs"
              className="space-y-3"
              data-testid="run-harness-form"
            >
              <input type="hidden" name="datasetId" value={dataset.id} />
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Adapter</span>
                <select
                  name="adapterName"
                  defaultValue={DEFAULT_ADAPTER_NAME}
                  className="h-8 px-2 rounded border border-border bg-bg text-[13px] text-text"
                >
                  {adapters.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.version}) · {a.governanceStatus}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-text-muted">
                <span>Notes</span>
                <textarea
                  name="notes"
                  rows={2}
                  className="px-2 py-1 rounded border border-border bg-bg text-[13px] text-text"
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-text">
                <input
                  type="checkbox"
                  name="acknowledgedValidationOnly"
                  required
                />
                <span>
                  I confirm this run is validation-only and will not be used as
                  load guidance.
                </span>
              </label>
              <div className="flex gap-2 pt-1">
                <Button type="submit">Run harness</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card data-testid="runs-list-card">
          <CardHeader
            title={`Recent runs (${dataset.runs.length})`}
            description="Most recent 25 runs against this dataset."
          />
          <CardBody>
            {dataset.runs.length === 0 ? (
              <p className="text-[12px] text-text-muted">No runs yet.</p>
            ) : (
              <div className="space-y-4">
                {dataset.runs.map((r) => {
                  const summary = safeParse(r.summaryJson);
                  const rejected = safeParse(r.rejectedForbiddenKeysJson);
                  return (
                    <div
                      key={r.id}
                      id={`run-${r.id}`}
                      className="border-t border-border pt-3"
                    >
                      <div className="flex items-start gap-3 flex-wrap">
                        <Badge
                          tone={
                            r.status === 'COMPLETED_NON_OPERATIONAL'
                              ? 'success'
                              : r.status === 'REJECTED_BY_GUARDRAIL'
                                ? 'danger'
                                : 'neutral'
                          }
                        >
                          {r.status}
                        </Badge>
                        <code className="text-[11px] text-text-faint">{r.id}</code>
                        <span className="text-[11px] text-text-faint">
                          {r.createdAt.toLocaleString()}
                        </span>
                        <Badge tone="warning">
                          {r.pressurePredictionStatus}
                        </Badge>
                        <span className="text-[11px] text-text-faint">
                          adapter: {r.adapterName} ({r.adapterVersion ?? '—'})
                        </span>
                      </div>
                      {summary && (
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px] mt-2">
                          <Stat label="Total cases" value={summary.totalCases} />
                          <Stat label="Completed" value={summary.completedCases} />
                          <Stat
                            label="Guardrail rejections"
                            value={summary.guardrailRejections}
                          />
                          <Stat
                            label="Within tolerance"
                            value={
                              summary.withinToleranceCount == null
                                ? '—'
                                : `${summary.withinToleranceCount}`
                            }
                          />
                          <Stat
                            label="Mean Δv (fps)"
                            value={fmt(summary.meanVelocityDeltaFps)}
                          />
                          <Stat
                            label="Mean |Δv| (fps)"
                            value={fmt(summary.meanAbsVelocityDeltaFps)}
                          />
                        </dl>
                      )}
                      {rejected && Array.isArray(rejected) && rejected.length > 0 && (
                        <p className="text-[12px] text-danger mt-2">
                          Forbidden keys observed: {rejected.join(', ')}
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-[11px] text-text-faint mt-2 whitespace-pre-line">
                          {r.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              {VALIDATION_ONLY_ACKNOWLEDGEMENT_MESSAGE} The forbidden-output
              sanitizer rejects any adapter response containing PSI, peak
              pressure, chamber pressure, charge recommendations, safe / unsafe
              verdicts, or powder substitutions.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fmt(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toFixed(1);
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-text-faint">{label}</dt>
      <dd className="text-text">{String(value ?? '—')}</dd>
    </div>
  );
}
