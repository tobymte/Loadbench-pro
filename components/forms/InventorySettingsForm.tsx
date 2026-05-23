'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Props = {
  componentId: string;
  initialQuantityOnHand: number | null;
  initialUnit: string | null;
  initialLowStockThreshold: number | null;
  initialLotNumber: string | null;
  defaultUnit: string;
};

export function InventorySettingsForm({
  componentId,
  initialQuantityOnHand,
  initialUnit,
  initialLowStockThreshold,
  initialLotNumber,
  defaultUnit,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [qty, setQty] = useState(
    initialQuantityOnHand != null ? String(initialQuantityOnHand) : '',
  );
  const [unit, setUnit] = useState(initialUnit ?? defaultUnit);
  const [threshold, setThreshold] = useState(
    initialLowStockThreshold != null ? String(initialLowStockThreshold) : '',
  );
  const [lot, setLot] = useState(initialLotNumber ?? '');

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const body: Record<string, unknown> = {
      unit: unit.trim() === '' ? null : unit.trim(),
      lotNumber: lot.trim() === '' ? null : lot.trim(),
    };
    if (qty.trim() === '') {
      body.quantityOnHand = null;
    } else {
      const n = Number(qty);
      if (!Number.isFinite(n) || n < 0) {
        setError('Quantity must be a non-negative number.');
        return;
      }
      body.quantityOnHand = n;
    }
    if (threshold.trim() === '') {
      body.lowStockThreshold = null;
    } else {
      const n = Number(threshold);
      if (!Number.isFinite(n) || n < 0) {
        setError('Low-stock threshold must be a non-negative number.');
        return;
      }
      body.lowStockThreshold = n;
    }

    startTransition(async () => {
      const res = await fetch(`/api/components/${componentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        return;
      }
      setError('Could not save inventory settings.');
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid="inventory-settings-form">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label htmlFor="qty">Quantity on hand</label>
          <input
            id="qty"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            data-testid="inventory-settings-qty"
          />
        </div>
        <div>
          <label htmlFor="unit">Unit</label>
          <input
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={defaultUnit}
            data-testid="inventory-settings-unit"
          />
          <p className="text-[11px] text-text-faint mt-1">
            Use “lb” or “gr” for powder; “ct” for bullets/primers/cases.
          </p>
        </div>
        <div>
          <label htmlFor="threshold">Low-stock threshold</label>
          <input
            id="threshold"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            data-testid="inventory-settings-threshold"
          />
        </div>
        <div>
          <label htmlFor="lot">Lot number</label>
          <input
            id="lot"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            data-testid="inventory-settings-lot"
          />
        </div>
      </div>
      {error && (
        <div className="text-[12px] text-danger">{error}</div>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save inventory'}
        </Button>
        {saved && (
          <span className="text-[11px] text-success">Saved.</span>
        )}
      </div>
    </form>
  );
}
