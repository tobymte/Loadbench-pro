import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';

export type NextStepStatus = 'todo' | 'doing' | 'done';

const statusBadge: Record<NextStepStatus, { tone: 'neutral' | 'warning' | 'success'; label: string }> = {
  todo: { tone: 'warning', label: 'To do' },
  doing: { tone: 'neutral', label: 'In progress' },
  done: { tone: 'success', label: 'Done' },
};

export type NextStep = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  status: NextStepStatus;
};

export function NextStepList({
  steps,
  testid,
}: {
  steps: NextStep[];
  testid?: string;
}) {
  return (
    <ol
      className="divide-y divide-border rounded-md border border-border overflow-hidden bg-bg-surface"
      data-testid={testid}
    >
      {steps.map((step, i) => {
        const s = statusBadge[step.status];
        return (
          <li
            key={step.key}
            className={cn(
              'flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between px-4 py-3',
              step.status === 'done' && 'opacity-70',
            )}
            data-testid={`next-step-${step.key}`}
          >
            <div className="flex gap-3 min-w-0">
              <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full border border-border flex items-center justify-center text-[11px] text-text-muted tabular-nums">
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text">{step.title}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
            <div className="sm:ml-4 shrink-0">
              <Link
                href={step.href}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors h-7 px-2.5 text-[12px]',
                  step.status === 'done'
                    ? 'bg-bg-alt text-text-muted border border-border hover:border-border-strong'
                    : 'bg-accent text-bg hover:bg-accent-hover',
                )}
                data-testid={`next-step-${step.key}-cta`}
              >
                {step.cta} →
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
