// Client-side enhancements for the bulk-verify form on the Shooters World /
// CIP admin page. The form, checkboxes, and submit button are server-rendered
// (see page.tsx) so the flow works without JS. This component only:
//
//   - mirrors the count of ticked row checkboxes into the "Selected: N of M"
//     label so admins can see what they're about to submit;
//   - wires the "Select all visible eligible" master checkbox to tick / untick
//     every row checkbox in the bulk-verify form.
//
// SAFETY: this component does not perform pressure prediction, charge advice,
// or any safe/unsafe verdict. It only manages checkbox UI state. Submission
// still goes to /api/admin/cip-reference/bulk-verify, which re-checks the
// admin gate, the workspace scope, and the explicit acknowledgement.

'use client';

import { useEffect } from 'react';

export function CipBulkVerifyControls() {
  useEffect(() => {
    const form = document.getElementById(
      'cip-bulk-verify-form',
    ) as HTMLFormElement | null;
    if (!form) return;

    const rowCheckboxes = () =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[data-bulk-select-row]',
        ),
      );
    const selectAll = form.querySelector<HTMLInputElement>(
      'input[data-bulk-select-all]',
    );
    const counter = form.querySelector<HTMLElement>('[data-bulk-selected-count]');

    function refreshCount() {
      if (!counter) return;
      const n = rowCheckboxes().filter((c) => c.checked).length;
      counter.textContent = String(n);
    }

    function onSelectAll(e: Event) {
      const target = e.target as HTMLInputElement;
      for (const c of rowCheckboxes()) c.checked = target.checked;
      refreshCount();
    }

    function onRowChange() {
      refreshCount();
      if (!selectAll) return;
      const boxes = rowCheckboxes();
      const allChecked = boxes.length > 0 && boxes.every((c) => c.checked);
      selectAll.checked = allChecked;
    }

    selectAll?.addEventListener('change', onSelectAll);
    for (const c of rowCheckboxes()) {
      c.addEventListener('change', onRowChange);
    }
    refreshCount();

    return () => {
      selectAll?.removeEventListener('change', onSelectAll);
      for (const c of rowCheckboxes()) {
        c.removeEventListener('change', onRowChange);
      }
    };
  }, []);

  return null;
}
