'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

export type PrintableLoad = {
  id: string;
  name: string;
  status: string;
  chargeGr: number | null;
  cartridgeOalIn: number | null;
  cartridgeBaseToOgiveIn: number | null;
  caseTrimLengthIn: number | null;
  neckTensionThou: number | null;
  safetyAcknowledged: boolean;
  safetyNotes: string | null;
  notes: string | null;
  cartridge: { name: string } | null;
  bullet: {
    manufacturer: string;
    model: string;
    bulletWeightGr: number | null;
  } | null;
  powder: {
    manufacturer: string;
    model: string;
    burnRateLabel: string | null;
  } | null;
  primer: { manufacturer: string; model: string } | null;
  case_: { manufacturer: string; model: string } | null;
  rifle: {
    name: string;
    barrelLengthIn: number | null;
    twistRate: string | null;
    opticNotes: string | null;
    zeroDistanceYd: number | null;
  } | null;
  source: {
    title: string;
    publisher: string | null;
    edition: string | null;
    publishedYear: number | null;
    citation: string | null;
    publishedMaxGr: number | null;
  } | null;
  latestSession: {
    date: string;
    location: string | null;
    avgVelocityFps: number | null;
    esFps: number | null;
    sdFps: number | null;
    groupSizeIn: number | null;
    groupDistanceYd: number | null;
    shotsFired: number | null;
  } | null;
  chronoSummary: {
    sessionCount: number;
    latestAvgVelocityFps: number | null;
    bestGroupSizeIn: number | null;
    avgSdFps: number | null;
  } | null;
};

export type PrintableComponent = {
  id: string;
  kind: 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE';
  manufacturer: string;
  model: string;
  bulletWeightGr: number | null;
  bulletBc: number | null;
  burnRateLabel: string | null;
  lotNumber: string | null;
  notes: string | null;
};

type Mode = 'cards' | 'labels';

export function Printables({
  loads,
  components,
}: {
  loads: PrintableLoad[];
  components: PrintableComponent[];
}) {
  const [mode, setMode] = useState<Mode>('cards');
  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set());
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(
    new Set(),
  );

  const visibleLoads = useMemo(
    () => loads.filter((l) => selectedLoads.has(l.id)),
    [loads, selectedLoads],
  );
  const visibleComponents = useMemo(
    () => components.filter((c) => selectedComponents.has(c.id)),
    [components, selectedComponents],
  );

  function toggleLoad(id: string) {
    setSelectedLoads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleComponent(id: string) {
    setSelectedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllLoads() {
    setSelectedLoads(new Set(loads.map((l) => l.id)));
  }

  function selectAllComponents() {
    setSelectedComponents(new Set(components.map((c) => c.id)));
  }

  function clearSelection() {
    setSelectedLoads(new Set());
    setSelectedComponents(new Set());
  }

  function doPrint() {
    if (typeof window !== 'undefined') window.print();
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        <Card>
          <CardHeader
            title="Printables"
            description="Select loads or components, choose a layout, and print. Cards and labels are user-entered citations and observations — LoadBench Pro does not recommend or validate load safety."
            actions={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={mode === 'cards' ? 'primary' : 'secondary'}
                  onClick={() => setMode('cards')}
                  data-testid="mode-cards"
                >
                  Range cards
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'labels' ? 'primary' : 'secondary'}
                  onClick={() => setMode('labels')}
                  data-testid="mode-labels"
                >
                  Component labels
                </Button>
                <Button
                  size="sm"
                  onClick={doPrint}
                  disabled={
                    mode === 'cards'
                      ? visibleLoads.length === 0
                      : visibleComponents.length === 0
                  }
                  data-testid="print-button"
                >
                  Print
                </Button>
              </div>
            }
          />
          <CardBody>
            {mode === 'cards' ? (
              <LoadSelector
                loads={loads}
                selected={selectedLoads}
                onToggle={toggleLoad}
                onAll={selectAllLoads}
                onClear={clearSelection}
              />
            ) : (
              <ComponentSelector
                components={components}
                selected={selectedComponents}
                onToggle={toggleComponent}
                onAll={selectAllComponents}
                onClear={clearSelection}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="print:block">
        {mode === 'cards' && visibleLoads.length > 0 && (
          <div className="space-y-6 print:space-y-0" data-testid="printable-cards">
            {visibleLoads.map((load) => (
              <RangeCard key={load.id} load={load} />
            ))}
          </div>
        )}
        {mode === 'labels' && visibleComponents.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2"
            data-testid="printable-labels"
          >
            {visibleComponents.map((c) => (
              <ComponentLabel key={c.id} component={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadSelector({
  loads,
  selected,
  onToggle,
  onAll,
  onClear,
}: {
  loads: PrintableLoad[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Button size="sm" variant="ghost" onClick={onAll}>
          Select all
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
        <span className="text-[11px] text-text-faint ml-auto">
          {selected.size} selected
        </span>
      </div>
      {loads.length === 0 ? (
        <p className="text-sm text-text-muted">
          No loads recorded yet. Record a load to print a range card.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {loads.map((l) => (
            <li key={l.id} className="py-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => onToggle(l.id)}
                  className="!w-4 !h-4 mt-1"
                  data-testid={`load-pick-${l.id}`}
                />
                <div className="text-sm">
                  <div className="font-medium text-text">{l.name}</div>
                  <div className="text-[11px] text-text-muted">
                    {l.cartridge?.name ?? '—'} ·{' '}
                    {l.bullet
                      ? `${l.bullet.manufacturer} ${l.bullet.model}`
                      : '—'}{' '}
                    ·{' '}
                    {l.powder
                      ? `${l.powder.manufacturer} ${l.powder.model}`
                      : '—'}
                    {l.chargeGr ? ` · ${l.chargeGr} gr` : ''}
                  </div>
                </div>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComponentSelector({
  components,
  selected,
  onToggle,
  onAll,
  onClear,
}: {
  components: PrintableComponent[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Button size="sm" variant="ghost" onClick={onAll}>
          Select all
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
        <span className="text-[11px] text-text-faint ml-auto">
          {selected.size} selected
        </span>
      </div>
      {components.length === 0 ? (
        <p className="text-sm text-text-muted">
          No components recorded yet. Record components to print labels.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {components.map((c) => (
            <li key={c.id} className="py-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => onToggle(c.id)}
                  className="!w-4 !h-4 mt-1"
                  data-testid={`component-pick-${c.id}`}
                />
                <div className="text-sm">
                  <div className="font-medium text-text">
                    {c.manufacturer} {c.model}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {c.kind}
                    {c.lotNumber ? ` · lot ${c.lotNumber}` : ''}
                    {c.bulletWeightGr ? ` · ${c.bulletWeightGr} gr` : ''}
                  </div>
                </div>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RangeCard({ load }: { load: PrintableLoad }) {
  return (
    <article className="print-card border border-border bg-bg-surface rounded-lg p-5 break-inside-avoid print:break-after-page print:border-black print:bg-white print:text-black">
      <header className="flex items-baseline justify-between border-b border-border print:border-black pb-2 mb-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{load.name}</h3>
          <p className="text-[11px] text-text-muted print:text-black">
            {load.cartridge?.name ?? '—'} · {load.status}
          </p>
        </div>
        <div className="text-[11px] text-text-muted print:text-black">
          LoadBench Pro · Range card
        </div>
      </header>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm print:grid-cols-4">
        <Field label="Bullet" value={load.bullet ? `${load.bullet.manufacturer} ${load.bullet.model}${load.bullet.bulletWeightGr ? ` ${load.bullet.bulletWeightGr}gr` : ''}` : '—'} />
        <Field
          label="Powder"
          value={
            load.powder
              ? `${load.powder.manufacturer} ${load.powder.model}${load.powder.burnRateLabel ? ` (${load.powder.burnRateLabel})` : ''}`
              : '—'
          }
        />
        <Field
          label="Primer"
          value={
            load.primer ? `${load.primer.manufacturer} ${load.primer.model}` : '—'
          }
        />
        <Field
          label="Case"
          value={
            load.case_ ? `${load.case_.manufacturer} ${load.case_.model}` : '—'
          }
        />
        <Field
          label="Charge (gr)"
          value={load.chargeGr != null ? String(load.chargeGr) : '—'}
          mono
        />
        <Field
          label="OAL (in)"
          value={load.cartridgeOalIn != null ? String(load.cartridgeOalIn) : '—'}
          mono
        />
        <Field
          label="Base→ogive (in)"
          value={
            load.cartridgeBaseToOgiveIn != null
              ? String(load.cartridgeBaseToOgiveIn)
              : '—'
          }
          mono
        />
        <Field label="Rifle" value={load.rifle?.name ?? '—'} />
      </dl>

      <div className="mt-3 border-t border-border print:border-black pt-2 text-[12px]">
        <div className="text-[10px] uppercase tracking-wider text-text-faint print:text-black">
          Source
        </div>
        <div className="text-text print:text-black">
          {load.source
            ? `${load.source.title}${load.source.edition ? `, ${load.source.edition}` : ''}${load.source.publishedYear ? ` (${load.source.publishedYear})` : ''}${load.source.publisher ? ` — ${load.source.publisher}` : ''}${load.source.citation ? ` · ${load.source.citation}` : ''}`
            : 'No source cited.'}
        </div>
      </div>

      {load.rifle && (
        <div className="mt-2 border-t border-border print:border-black pt-2 text-[12px]">
          <div className="text-[10px] uppercase tracking-wider text-text-faint print:text-black">
            Rifle profile
          </div>
          <div className="text-text print:text-black">
            {load.rifle.name}
            {load.rifle.barrelLengthIn != null
              ? ` · ${load.rifle.barrelLengthIn}" bbl`
              : ''}
            {load.rifle.twistRate ? ` · ${load.rifle.twistRate} twist` : ''}
            {load.rifle.zeroDistanceYd != null
              ? ` · ${load.rifle.zeroDistanceYd}yd zero`
              : ''}
            {load.rifle.opticNotes ? ` · ${load.rifle.opticNotes}` : ''}
          </div>
        </div>
      )}

      {load.latestSession && (
        <div className="mt-2 border-t border-border print:border-black pt-2 text-[12px]">
          <div className="text-[10px] uppercase tracking-wider text-text-faint print:text-black">
            Latest session
          </div>
          <div className="text-text print:text-black">
            {new Date(load.latestSession.date).toLocaleDateString()}
            {load.latestSession.location ? ` · ${load.latestSession.location}` : ''}
            {load.latestSession.shotsFired != null
              ? ` · ${load.latestSession.shotsFired} shots`
              : ''}
            {load.latestSession.avgVelocityFps != null
              ? ` · avg ${load.latestSession.avgVelocityFps} fps`
              : ''}
            {load.latestSession.esFps != null ? ` · ES ${load.latestSession.esFps}` : ''}
            {load.latestSession.sdFps != null ? ` · SD ${load.latestSession.sdFps}` : ''}
            {load.latestSession.groupSizeIn != null
              ? ` · group ${load.latestSession.groupSizeIn}"${load.latestSession.groupDistanceYd != null ? ` @ ${load.latestSession.groupDistanceYd}yd` : ''}`
              : ''}
          </div>
        </div>
      )}

      {load.chronoSummary && load.chronoSummary.sessionCount > 0 && (
        <div className="mt-2 border-t border-border print:border-black pt-2 text-[12px]">
          <div className="text-[10px] uppercase tracking-wider text-text-faint print:text-black">
            Chrono summary (observed)
          </div>
          <div className="text-text print:text-black">
            {load.chronoSummary.sessionCount} session
            {load.chronoSummary.sessionCount === 1 ? '' : 's'}
            {load.chronoSummary.latestAvgVelocityFps != null
              ? ` · latest avg ${load.chronoSummary.latestAvgVelocityFps} fps`
              : ''}
            {load.chronoSummary.avgSdFps != null
              ? ` · avg SD ${load.chronoSummary.avgSdFps}`
              : ''}
            {load.chronoSummary.bestGroupSizeIn != null
              ? ` · best group ${load.chronoSummary.bestGroupSizeIn}"`
              : ''}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <NoteBox label="Observations" />
        <NoteBox label="Conditions" />
      </div>

      <footer className="mt-3 pt-2 border-t border-border print:border-black text-[10px] text-text-faint print:text-black leading-snug">
        Values shown are user-entered citations and observations. LoadBench Pro
        does not recommend, predict, or certify charge weights. The shooter is
        solely responsible for any load fired.
      </footer>
    </article>
  );
}

function ComponentLabel({ component }: { component: PrintableComponent }) {
  return (
    <article className="print-label border border-border bg-bg-surface rounded-md p-3 break-inside-avoid print:border-black print:bg-white print:text-black">
      <header className="flex items-baseline justify-between border-b border-border print:border-black pb-1.5 mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-faint print:text-black">
            {component.kind}
          </div>
          <h3 className="text-sm font-semibold tracking-tight">
            {component.manufacturer} {component.model}
          </h3>
        </div>
        <div className="text-[10px] text-text-muted print:text-black">
          LoadBench Pro
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <Field label="Lot" value={component.lotNumber ?? '—'} />
        {component.kind === 'BULLET' && (
          <>
            <Field
              label="Weight (gr)"
              value={
                component.bulletWeightGr != null
                  ? String(component.bulletWeightGr)
                  : '—'
              }
              mono
            />
            <Field
              label="BC"
              value={component.bulletBc != null ? String(component.bulletBc) : '—'}
              mono
            />
          </>
        )}
        {component.kind === 'POWDER' && (
          <Field label="Burn rate" value={component.burnRateLabel ?? '—'} />
        )}
      </dl>
      {component.notes && (
        <p className="mt-2 text-[11px] text-text-muted print:text-black whitespace-pre-wrap">
          {component.notes}
        </p>
      )}
      <NoteBox label="Notes" small />
    </article>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-faint print:text-black">
        {label}
      </dt>
      <dd className={'text-sm ' + (mono ? 'font-mono tabular-nums' : 'font-medium')}>
        {value}
      </dd>
    </div>
  );
}

function NoteBox({ label, small }: { label: string; small?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-faint print:text-black mb-1">
        {label}
      </div>
      <div
        className={
          'border border-dashed border-border print:border-black rounded ' +
          (small ? 'h-10' : 'h-16')
        }
      />
    </div>
  );
}
