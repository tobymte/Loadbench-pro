import Link from 'next/link';
import { cn } from '@/lib/utils';

export type PressureEngineStep = 'overview' | 'setup' | 'new' | 'detail';

type StepDef = {
  key: PressureEngineStep;
  number: number;
  label: string;
  description: string;
  href: string;
};

const STEPS: StepDef[] = [
  {
    key: 'overview',
    number: 1,
    label: 'Overview',
    description: 'Workspace, dashboard, and run history.',
    href: '/pressure-engine',
  },
  {
    key: 'setup',
    number: 2,
    label: 'Setup wizard',
    description: 'Readiness checklist of required inputs.',
    href: '/pressure-engine/setup',
  },
  {
    key: 'new',
    number: 3,
    label: 'Run builder',
    description: 'Select records and save a validation run.',
    href: '/pressure-engine/new',
  },
  {
    key: 'detail',
    number: 4,
    label: 'Run detail',
    description: 'Per-run drill-down. No PSI, no verdict.',
    href: '/pressure-engine',
  },
];

export function PressureEngineSteps({
  active,
  className,
}: {
  active: PressureEngineStep;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-center gap-2 text-[11px]',
        className,
      )}
      data-testid="pressure-engine-steps"
      aria-label="Pressure engine flow"
    >
      {STEPS.map((step, i) => {
        const isActive = step.key === active;
        const isClickable = step.key !== 'detail';
        const content = (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
              isActive
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-border bg-bg-surface text-text-muted hover:text-text',
            )}
          >
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-bg-alt text-[10px] tabular-nums">
              {step.number}
            </span>
            <span className="font-medium">{step.label}</span>
          </span>
        );
        return (
          <li key={step.key} className="flex items-center gap-2">
            {isClickable ? (
              <Link
                href={step.href}
                title={step.description}
                aria-current={isActive ? 'step' : undefined}
              >
                {content}
              </Link>
            ) : (
              <span aria-current={isActive ? 'step' : undefined}>{content}</span>
            )}
            {i < STEPS.length - 1 && (
              <span aria-hidden className="text-text-faint">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
