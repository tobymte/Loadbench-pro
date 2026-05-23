import { cn } from '@/lib/utils';

type Tone = 'default' | 'accent' | 'warning';

const toneStyles: Record<Tone, string> = {
  default: 'border-border',
  accent: 'border-accent/40 bg-accent-subtle/30',
  warning: 'border-warning/40 bg-warning-subtle/30',
};

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  tone = 'default',
  testid,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  tone?: Tone;
  testid?: string;
}) {
  return (
    <div
      className={cn(
        'border border-dashed rounded-lg px-8 py-10 text-center',
        toneStyles[tone],
      )}
      data-testid={testid}
    >
      <h3 className="text-sm font-medium text-text">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
