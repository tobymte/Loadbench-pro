'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const SEVERITIES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

export function ReviewCenterFilters({
  categories,
  category,
  severity,
}: {
  categories: string[];
  category: string;
  severity: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: 'category' | 'severity', value: string) {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.replace(`/data-quality${next.toString() ? `?${next.toString()}` : ''}`);
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label htmlFor="dq-category" className="text-[11px] uppercase tracking-wider text-text-faint">
          Category
        </label>
        <select
          id="dq-category"
          value={category}
          onChange={(e) => setParam('category', e.target.value)}
          data-testid="dq-filter-category"
          disabled={pending}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="dq-severity" className="text-[11px] uppercase tracking-wider text-text-faint">
          Severity
        </label>
        <select
          id="dq-severity"
          value={severity}
          onChange={(e) => setParam('severity', e.target.value)}
          data-testid="dq-filter-severity"
          disabled={pending}
        >
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-1 flex items-end">
        <button
          type="button"
          onClick={() => {
            startTransition(() => router.replace('/data-quality'));
          }}
          className="text-[12px] text-accent hover:text-accent-hover"
          disabled={pending}
          data-testid="dq-filter-clear"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
