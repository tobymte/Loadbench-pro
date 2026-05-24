'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function ReportingExportControls({
  summary,
}: {
  summary: Record<string, unknown>;
}) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(summary, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-validation-summary-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={copy} data-testid="reporting-copy">
          {copied ? 'Copied' : 'Copy JSON'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={download}
          data-testid="reporting-download"
        >
          Download .json
        </Button>
      </div>
      <pre
        className="text-[11px] bg-bg-alt/60 p-3 rounded overflow-x-auto max-h-72 overflow-y-auto"
        data-testid="reporting-summary"
      >
        {text}
      </pre>
    </div>
  );
}
