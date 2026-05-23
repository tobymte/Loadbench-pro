'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Props = {
  componentId: string;
  unit: string | null;
};

export function InventoryAdjustForm({ componentId, unit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [delta, setDelta] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(direction: 1 | -1) {
    setError(null);
    const n = Number(delta);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a positive number.');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/components/${componentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'adjust', delta: direction * n }),
      });
      if (res.ok) {
        setDelta('');
        router.refresh();
        return;
      }
      setError('Could not adjust inventory.');
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="inventory-adjust-form">
      <div>
        <label htmlFor="adjust-delta" className="text-[11px] text-text-faint">
          Amount {unit ? `(${unit})` : ''}
        </label>
        <input
          id="adjust-delta"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="h-8 w-32"
          data-testid="inventory-adjust-delta"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => submit(1)}
        data-testid="inventory-adjust-add"
      >
        + Add stock
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => submit(-1)}
        data-testid="inventory-adjust-consume"
      >
        − Consume
      </Button>
      {error && (
        <span className="text-[11px] text-danger">{error}</span>
      )}
      <span className="text-[11px] text-text-faint">
        Recordkeeping only.
      </span>
    </div>
  );
}
