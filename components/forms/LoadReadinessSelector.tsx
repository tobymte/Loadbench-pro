'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/Badge';
import type {
  ReadinessLevel,
  ReadinessReport,
} from '@/lib/analysis/pressureReadiness';

type LoadOption = { id: string; name: string };

type SolverInputCounts = {
  caseCapacity: number;
  bulletDimensions: number;
  powderMetadata: number;
  barrelGeometry: number;
  chronoCalibration: number;
};

type ReadinessResponse = {
  load: { id: string; name: string };
  readiness: ReadinessReport;
  solverInputCounts?: SolverInputCounts;
};

function levelTone(
  level: ReadinessLevel,
): 'success' | 'warning' | 'danger' {
  if (level === 'complete') return 'success';
  if (level === 'partial') return 'warning';
  return 'danger';
}

function levelLabel(level: ReadinessLevel): string {
  if (level === 'complete') return 'Complete';
  if (level === 'partial') return 'Partial';
  return 'Missing';
}

export function LoadReadinessSelector({ loads }: { loads: LoadOption[] }) {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<ReadinessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    setReport(null);
    setError(null);
    if (!id) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/pressure-modeling/load-readiness/${encodeURIComponent(id)}`,
      );
      if (!res.ok) {
        setError('Could not load readiness report for this load.');
        return;
      }
      const data = (await res.json()) as ReadinessResponse;
      setReport(data);
    });
  }

  return (
    <div className="space-y-4" data-testid="load-readiness-selector">
      <div>
        <label htmlFor="readiness-load">Select a load to assess</label>
        <select
          id="readiness-load"
          onChange={onChange}
          defaultValue=""
          data-testid="load-readiness-load"
        >
          <option value="">— pick a load —</option>
          {loads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {pending && (
        <p className="text-[12px] text-text-muted">Reading completeness…</p>
      )}

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger-subtle px-4 py-2 text-[12px] text-danger">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-4" data-testid="load-readiness-report">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text">
              {report.load.name}
            </span>
            <Badge tone={levelTone(report.readiness.overall)}>
              {levelLabel(report.readiness.overall)}
            </Badge>
            <span className="text-[12px] text-text-muted">
              {report.readiness.presentCount} / {report.readiness.totalCount}{' '}
              inputs present
            </span>
          </div>

          <div
            className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-2 text-[12px] text-text"
            data-testid="load-readiness-no-prediction"
          >
            Not enough validated data to support any pressure prediction. This
            view reports input presence only — it does not compute pressure,
            recommend a charge, or judge safety.
          </div>

          {report.solverInputCounts && (
            <div
              className="border border-border rounded-md p-3"
              data-testid="load-readiness-solver-input-counts"
            >
              <div className="text-[12px] font-semibold text-text mb-2">
                Related solver-input records (counts only)
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[12px] text-text-muted">
                <li className="flex justify-between">
                  <span>Case capacity (cartridge / load / brass)</span>
                  <span className="text-text">
                    {report.solverInputCounts.caseCapacity}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Bullet dimensions (bullet component)</span>
                  <span className="text-text">
                    {report.solverInputCounts.bulletDimensions}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Powder metadata (powder component)</span>
                  <span className="text-text">
                    {report.solverInputCounts.powderMetadata}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Barrel geometry (rifle)</span>
                  <span className="text-text">
                    {report.solverInputCounts.barrelGeometry}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Chrono calibration (workspace)</span>
                  <span className="text-text">
                    {report.solverInputCounts.chronoCalibration}
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-text-faint">
                Counts only. No pressure math, no charge advice.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.readiness.categories.map((c) => (
              <div key={c.category} className="border border-border rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] font-semibold text-text">
                    {c.category}
                  </span>
                  <Badge tone={levelTone(c.level)}>{levelLabel(c.level)}</Badge>
                </div>
                <ul className="text-[12px] text-text-muted space-y-1">
                  {c.items.map((i) => (
                    <li
                      key={i.key}
                      className="flex items-center gap-2"
                      data-testid={`readiness-item-${i.key}`}
                    >
                      <span
                        aria-hidden
                        className={
                          'inline-block h-2 w-2 rounded-full ' +
                          (i.present ? 'bg-success' : 'bg-danger')
                        }
                      />
                      <span className={i.present ? 'text-text' : ''}>
                        {i.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
