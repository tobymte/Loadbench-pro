'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function HornadySetupButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        '/api/published-data-review/hornady-6mm-arc/setup',
        { method: 'POST' },
      );
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          bulletCount?: number;
          powderCount?: number;
        };
        setMessage(
          `Staged metadata: ${data.bulletCount ?? 0} bullets, ${
            data.powderCount ?? 0
          } powders. No charge rows were created.`,
        );
        router.refresh();
      } else {
        const out = (await res.json().catch(() => ({}))) as { error?: string };
        setError(out.error ?? 'Could not stage review set.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={run}
        disabled={pending || disabled}
        data-testid="published-hornady-6mm-arc-setup"
      >
        {pending ? 'Staging…' : 'Stage 6mm ARC Hornady review set'}
      </Button>
      {message && (
        <p className="text-[11px] text-success" data-testid="published-setup-message">
          {message}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-danger" data-testid="published-setup-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function VerifyRowControl({
  id,
  status,
}: {
  id: string;
  status: 'DRAFT' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(next: 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED' | 'DRAFT') {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/published-data-review/rows/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const out = (await res.json().catch(() => ({}))) as { error?: string };
        setError(out.error ?? 'Could not update row.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-1" data-testid={`row-verify-${id}`}>
      <div className="flex flex-wrap gap-1">
        {status !== 'VERIFIED' && (
          <Button
            type="button"
            size="sm"
            onClick={() => update('VERIFIED')}
            disabled={pending}
            data-testid={`row-verify-${id}-verify`}
          >
            Mark verified
          </Button>
        )}
        {status === 'VERIFIED' && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => update('NEEDS_REVIEW')}
            disabled={pending}
            data-testid={`row-verify-${id}-unverify`}
          >
            Un-verify
          </Button>
        )}
        {status !== 'NEEDS_REVIEW' && status !== 'VERIFIED' && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => update('NEEDS_REVIEW')}
            disabled={pending}
            data-testid={`row-verify-${id}-needs`}
          >
            Send to review
          </Button>
        )}
        {status !== 'REJECTED' && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => update('REJECTED')}
            disabled={pending}
            data-testid={`row-verify-${id}-reject`}
          >
            Reject
          </Button>
        )}
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
