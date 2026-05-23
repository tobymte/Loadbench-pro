'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { CompareRow } from '@/lib/analysis/compare';

type Option = { value: string; label: string };

type FilterOptions = {
  cartridges: Option[];
  rifles: Option[];
  powders: Option[];
  bullets: Option[];
  sources: Option[];
};

type LoadMeta = {
  id: string;
  cartridgeId: string | null;
  rifleId: string | null;
  powderId: string | null;
  bulletId: string | null;
  sourceId: string | null;
};

const STATUS_OPTIONS: Option[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'LOADED', label: 'Loaded' },
  { value: 'TESTED', label: 'Tested' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export function CompareTable({
  rows,
  meta,
  filterOptions,
}: {
  rows: CompareRow[];
  meta: LoadMeta[];
  filterOptions: FilterOptions;
}) {
  const [cartridgeId, setCartridgeId] = useState('');
  const [rifleId, setRifleId] = useState('');
  const [powderId, setPowderId] = useState('');
  const [bulletId, setBulletId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  const metaById = useMemo(() => {
    const m = new Map<string, LoadMeta>();
    for (const x of meta) m.set(x.id, x);
    return m;
  }, [meta]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const m = metaById.get(r.loadId);
      if (!m) return false;
      if (cartridgeId && m.cartridgeId !== cartridgeId) return false;
      if (rifleId && m.rifleId !== rifleId) return false;
      if (powderId && m.powderId !== powderId) return false;
      if (bulletId && m.bulletId !== bulletId) return false;
      if (sourceId && m.sourceId !== sourceId) return false;
      if (status && r.status !== status) return false;
      if (q) {
        const blob = [
          r.loadName,
          r.cartridgeName,
          r.bulletLabel,
          r.powderLabel,
          r.rifleName,
          r.sourceTitle,
        ]
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [
    rows,
    metaById,
    cartridgeId,
    rifleId,
    powderId,
    bulletId,
    sourceId,
    status,
    query,
  ]);

  const summary = useMemo(() => {
    const withSessions = filtered.filter((r) => r.sessionCount > 0);
    const sessionTotal = withSessions.reduce((s, r) => s + r.sessionCount, 0);
    const velocities = withSessions
      .map((r) => r.latestAvgVelocityFps)
      .filter((v): v is number => v != null);
    const groups = withSessions
      .map((r) => r.bestGroupSizeIn)
      .filter((v): v is number => v != null);
    const sds = withSessions
      .map((r) => r.avgSdFps)
      .filter((v): v is number => v != null);
    return {
      loadCount: filtered.length,
      loadsWithSessions: withSessions.length,
      sessionTotal,
      avgLatestVelocity:
        velocities.length > 0
          ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
          : null,
      bestGroup: groups.length > 0 ? Math.min(...groups) : null,
      avgSd:
        sds.length > 0
          ? Math.round((sds.reduce((a, b) => a + b, 0) / sds.length) * 10) / 10
          : null,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3"
        data-testid="compare-filters"
      >
        <FilterSelect
          label="Cartridge"
          value={cartridgeId}
          onChange={setCartridgeId}
          options={filterOptions.cartridges}
          testId="compare-filter-cartridge"
        />
        <FilterSelect
          label="Rifle"
          value={rifleId}
          onChange={setRifleId}
          options={filterOptions.rifles}
          testId="compare-filter-rifle"
        />
        <FilterSelect
          label="Powder"
          value={powderId}
          onChange={setPowderId}
          options={filterOptions.powders}
          testId="compare-filter-powder"
        />
        <FilterSelect
          label="Bullet"
          value={bulletId}
          onChange={setBulletId}
          options={filterOptions.bullets}
          testId="compare-filter-bullet"
        />
        <FilterSelect
          label="Source"
          value={sourceId}
          onChange={setSourceId}
          options={filterOptions.sources}
          testId="compare-filter-source"
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          testId="compare-filter-status"
        />
        <div>
          <label htmlFor="compare-search">Search</label>
          <input
            id="compare-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name, component…"
            data-testid="compare-filter-search"
          />
        </div>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
        data-testid="compare-summary"
      >
        <SummaryCell label="Loads" value={summary.loadCount.toString()} />
        <SummaryCell
          label="With sessions"
          value={summary.loadsWithSessions.toString()}
        />
        <SummaryCell label="Sessions" value={summary.sessionTotal.toString()} />
        <SummaryCell
          label="Avg latest vel"
          value={summary.avgLatestVelocity != null ? `${summary.avgLatestVelocity} fps` : '—'}
        />
        <SummaryCell
          label="Best group"
          value={summary.bestGroup != null ? `${summary.bestGroup} in` : '—'}
        />
        <SummaryCell
          label="Avg SD"
          value={summary.avgSd != null ? `${summary.avgSd} fps` : '—'}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-muted">
          No loads match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table data-testid="compare-table">
            <thead>
              <tr>
                <th>Load</th>
                <th>Cartridge</th>
                <th>Rifle</th>
                <th>Bullet</th>
                <th>Powder</th>
                <th className="text-right">Charge (gr)</th>
                <th>Source</th>
                <th>Status</th>
                <th>Safety ack</th>
                <th className="text-right">Sessions</th>
                <th className="text-right">Latest avg vel</th>
                <th className="text-right">Best group (in)</th>
                <th className="text-right">Dist (yd)</th>
                <th className="text-right">Avg SD</th>
                <th className="text-right">Avg ES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.loadId}>
                  <td>
                    <a
                      href={`/loads/${r.loadId}`}
                      className="text-accent hover:text-accent-hover"
                    >
                      {r.loadName}
                    </a>
                  </td>
                  <td className="text-text-muted">{r.cartridgeName}</td>
                  <td className="text-text-muted">{r.rifleName}</td>
                  <td className="text-text-muted">{r.bulletLabel}</td>
                  <td className="text-text-muted">{r.powderLabel}</td>
                  <td className="text-right tabular-nums">
                    {r.chargeGr ?? '—'}
                  </td>
                  <td className="text-text-muted">{r.sourceTitle}</td>
                  <td>
                    <Badge
                      tone={
                        r.status === 'TESTED'
                          ? 'success'
                          : r.status === 'LOADED'
                            ? 'accent'
                            : 'neutral'
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td>
                    {r.chargeGr != null ? (
                      <Badge tone={r.safetyAcknowledged ? 'success' : 'warning'}>
                        {r.safetyAcknowledged ? 'Ack' : 'Missing'}
                      </Badge>
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{r.sessionCount}</td>
                  <td className="text-right tabular-nums">
                    {r.latestAvgVelocityFps ?? '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.bestGroupSizeIn ?? '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.bestGroupDistanceYd ?? '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.avgSdFps ?? '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.avgEsFps ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  testId?: string;
}) {
  return (
    <div>
      <label htmlFor={testId ?? label}>{label}</label>
      <select
        id={testId ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-alt/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </div>
      <div className="text-sm font-medium tabular-nums text-text mt-0.5">
        {value}
      </div>
    </div>
  );
}
