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
  const [confirming, setConfirming] = useState<
    null | 'VERIFIED' | 'REJECTED'
  >(null);
  const [ack, setAck] = useState(false);
  const [notes, setNotes] = useState('');

  function update(
    next: 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED' | 'DRAFT',
    extra: Record<string, unknown> = {},
  ) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/published-data-review/rows/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next, ...extra }),
      });
      if (res.ok) {
        setConfirming(null);
        setAck(false);
        setNotes('');
        router.refresh();
      } else {
        const out = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: Array<{ message?: string }>;
        };
        const msg =
          out.issues?.find((i) => i.message)?.message ??
          out.error ??
          'Could not update row.';
        setError(msg);
      }
    });
  }

  function submitConfirm() {
    if (confirming === 'VERIFIED') {
      if (!ack) {
        setError(
          'Confirm "I verified this row against the original source." to mark it verified.',
        );
        return;
      }
      update('VERIFIED', {
        verificationAcknowledged: true,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    } else if (confirming === 'REJECTED') {
      update('REJECTED', {
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    }
  }

  return (
    <div className="flex flex-col gap-1" data-testid={`row-verify-${id}`}>
      <div className="flex flex-wrap gap-1">
        {status !== 'VERIFIED' && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setError(null);
              setConfirming('VERIFIED');
            }}
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
            onClick={() => {
              setError(null);
              setConfirming('REJECTED');
            }}
            disabled={pending}
            data-testid={`row-verify-${id}-reject`}
          >
            Reject
          </Button>
        )}
      </div>

      {confirming !== null && (
        <div
          className="mt-1 rounded-md border border-warning/40 bg-warning-subtle p-2 text-[11px] text-text"
          data-testid={`row-verify-${id}-confirm`}
        >
          {confirming === 'VERIFIED' ? (
            <label className="flex items-start gap-2 leading-snug">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                data-testid={`row-verify-${id}-ack`}
              />
              <span>
                I verified this row against the original source.
              </span>
            </label>
          ) : (
            <p className="leading-snug">
              Reject this user-entered source row?
            </p>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional verification notes (e.g. page reference, discrepancies)"
            className="mt-2 w-full text-[11px]"
            data-testid={`row-verify-${id}-notes`}
          />
          <div className="mt-2 flex gap-1">
            <Button
              type="button"
              size="sm"
              onClick={submitConfirm}
              disabled={pending || (confirming === 'VERIFIED' && !ack)}
              data-testid={`row-verify-${id}-confirm-submit`}
            >
              {pending
                ? 'Saving…'
                : confirming === 'VERIFIED'
                ? 'Confirm verified'
                : 'Confirm reject'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setConfirming(null);
                setAck(false);
                setNotes('');
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p
          className="text-[11px] text-danger"
          data-testid={`row-verify-${id}-error`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function CreateLoadDraftFromRow({
  id,
  hasCartridge,
  hasBullet,
  hasPowder,
  hasSource,
  hasCharge,
}: {
  id: string;
  hasCartridge: boolean;
  hasBullet: boolean;
  hasPowder: boolean;
  hasSource: boolean;
  hasCharge: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const missing: string[] = [];
  if (!hasCartridge) missing.push('cartridge');
  if (!hasBullet) missing.push('bullet component');
  if (!hasPowder) missing.push('powder component');
  if (!hasSource) missing.push('cited source');
  if (!hasCharge) missing.push('charge');
  const blocked = missing.length > 0;

  function submit() {
    if (!ack) {
      setError(
        'You must explicitly acknowledge the safety disclaimer before creating a load draft.',
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/published-data-review/rows/${id}/create-load-draft`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ safetyAcknowledged: true }),
        },
      );
      if (res.ok) {
        const out = (await res.json().catch(() => ({}))) as {
          id?: string;
        };
        setCreatedId(out.id ?? null);
        setOpen(false);
        router.refresh();
      } else {
        const out = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: Array<{ message?: string }>;
        };
        const msg =
          out.issues?.find((i) => i.message)?.message ??
          out.error ??
          'Could not create load draft.';
        setError(msg);
      }
    });
  }

  if (createdId) {
    return (
      <a
        href={`/loads/${createdId}`}
        className="text-[11px] text-accent hover:text-accent-hover"
        data-testid={`published-row-${id}-create-load-success`}
      >
        Open load draft →
      </a>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          disabled={blocked}
          data-testid={`published-row-${id}-create-load`}
          title={
            blocked
              ? `Row is missing required references: ${missing.join(', ')}.`
              : 'Create a Load draft from this user-verified source row. Safety validation still applies.'
          }
        >
          Create load draft
        </Button>
        {blocked && (
          <span
            className="text-[10px] text-text-faint"
            data-testid={`published-row-${id}-create-load-missing`}
          >
            Missing: {missing.join(', ')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-[11px] text-text"
      data-testid={`published-row-${id}-create-load-confirm`}
    >
      <p className="leading-snug">
        Create a Load draft from this user-verified source row. The normal load
        safety validation still applies (cited source, charge ≤ published max).
      </p>
      <label className="mt-2 flex items-start gap-2 leading-snug">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          data-testid={`published-row-${id}-create-load-ack`}
        />
        <span>
          I acknowledge the safety disclaimer and that I am responsible for
          verifying this charge against my own references.
        </span>
      </label>
      {error && (
        <p
          className="mt-2 text-[11px] text-danger"
          data-testid={`published-row-${id}-create-load-error`}
        >
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-1">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={pending || !ack}
          data-testid={`published-row-${id}-create-load-submit`}
        >
          {pending ? 'Creating…' : 'Create draft'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setAck(false);
            setError(null);
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
