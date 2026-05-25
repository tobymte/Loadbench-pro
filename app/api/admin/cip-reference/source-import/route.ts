// Assisted CIP Source Import — create-draft endpoint.
//
// POST (form) -> 303 redirect to /admin/shooters-world-cip
//
// SAFETY: This endpoint creates a DRAFT CipReferenceRecord seeded with
// source metadata (URL, label, optional date) and any cartridge / powder
// fields the admin chose to fill in on the import form. It NEVER:
//   - extracts numeric values (Pmax, volumes, rifling) from the source
//   - auto-verifies the record (always DRAFT on create)
//   - predicts or implies chamber pressure
//   - converts pressure units between PSI and BAR/MPa for "safety" purposes
// All numeric reference fields are left null on create — the admin must
// transcribe them on the admin index page and then explicitly verify
// against the cited source.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminContext } from '@/lib/auth/admin';
import { getWorkspaceContext } from '@/lib/auth/workspace';
import {
  cipRecordCreateSchema,
  CIP_SAFETY_BOUNDARY_MESSAGE,
} from '@/lib/validation/cipReference';
import { createCipRecord } from '@/lib/validation/cipReferenceDb';
import { findForbiddenKeys } from '@/lib/ballistics/modelAdapter';
import {
  deriveSourceDate,
  deriveSourceLabel,
  fetchCipSourceMetadata,
  isKnownCipHost,
  validateAndNormalizeUrl,
} from '@/lib/validation/cipSourceFetch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}

function redirect(
  request: Request,
  to: '/admin/shooters-world-cip' | '/admin/shooters-world-cip/import',
  params: Record<string, string>,
) {
  const url = new URL(to, request.url);
  url.search = new URLSearchParams(params).toString();
  return NextResponse.redirect(url, { status: 303 });
}

async function readForm(req: Request): Promise<Record<string, unknown>> {
  const form = await req.formData();
  const obj: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    obj[k] = typeof v === 'string' ? v : null;
  }
  return obj;
}

const importInputShape = z.object({
  sourceUrl: z.string().trim().min(1, 'Source URL is required.'),
  cartridgeName: z
    .string()
    .trim()
    .min(1, 'Cartridge name is required.')
    .max(200),
  cartridgeCaliberLabel: z.string().trim().max(500).optional(),
  powderManufacturer: z.string().trim().max(500).optional(),
  powderFamily: z.string().trim().max(500).optional(),
  powderName: z.string().trim().max(500).optional(),
  sourceLabel: z.string().trim().max(500).optional(),
  sourceRevision: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  // The admin can untick this when they trust a host that is not on the
  // built-in allow-list. If unticked AND the host is unknown, we refuse.
  acknowledgedNonCipHost: z.string().optional(),
  // Whether we should perform a network fetch. If "no", we still create a
  // draft from the URL alone (manual fallback).
  fetchPreview: z.string().optional(),
});

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) return unauthorized();

  let ctx: Awaited<ReturnType<typeof getWorkspaceContext>>;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return redirect(request, '/admin/shooters-world-cip/import', {
      error:
        e instanceof Error
          ? e.message
          : 'Workspace not configured. Run prisma migrate deploy.',
    });
  }

  const raw = await readForm(request);

  // Defence in depth: refuse forbidden keys at the entry point.
  const forbidden = findForbiddenKeys(raw);
  if (forbidden.length > 0) {
    return redirect(request, '/admin/shooters-world-cip/import', {
      error: `Forbidden keys rejected: ${forbidden.join(
        ', ',
      )}. ${CIP_SAFETY_BOUNDARY_MESSAGE}`,
    });
  }

  const parsedShape = importInputShape.safeParse(raw);
  if (!parsedShape.success) {
    const issue = parsedShape.error.issues[0];
    return redirect(request, '/admin/shooters-world-cip/import', {
      error: `Invalid input: ${issue.path.join('.') || 'form'} — ${
        issue.message
      }`,
    });
  }
  const input = parsedShape.data;

  const validatedUrl = validateAndNormalizeUrl(input.sourceUrl);
  if (!validatedUrl.ok) {
    return redirect(request, '/admin/shooters-world-cip/import', {
      error: validatedUrl.reason,
    });
  }

  // Host gating: block unknown hosts unless the admin has explicitly
  // acknowledged that they trust a non-CIP source.
  const knownHost = isKnownCipHost(validatedUrl.host);
  if (!knownHost && input.acknowledgedNonCipHost !== 'on') {
    return redirect(request, '/admin/shooters-world-cip/import', {
      error:
        `Host "${validatedUrl.host}" is not on the CIP allow-list. ` +
        'Tick "I trust this non-CIP source" to override, or use an official CIP URL.',
      sourceUrl: validatedUrl.url,
    });
  }

  // Optional metadata fetch. When the admin opted out, or the fetch fails,
  // we still create a draft seeded with whatever they pasted.
  let labelFromFetch: string | null = null;
  let dateFromFetch: Date | null = null;
  let fetchWarning: string | null = null;
  if (input.fetchPreview !== 'off') {
    const meta = await fetchCipSourceMetadata(validatedUrl.url);
    labelFromFetch = deriveSourceLabel(meta);
    dateFromFetch = deriveSourceDate(meta);
    if (meta.errorMessage) {
      fetchWarning = meta.errorMessage;
    }
  }

  const draftInput = {
    cartridgeName: input.cartridgeName,
    cartridgeCaliberLabel: input.cartridgeCaliberLabel || undefined,
    powderManufacturer: input.powderManufacturer || undefined,
    powderFamily: input.powderFamily || undefined,
    powderName: input.powderName || undefined,
    sourceUrl: validatedUrl.url,
    sourceLabel: input.sourceLabel || labelFromFetch || undefined,
    sourceRevision: input.sourceRevision || undefined,
    sourceDate: dateFromFetch ?? undefined,
    // Technical numeric fields are intentionally left blank. The admin
    // must transcribe Pmax / volumes / rifling on the main admin page
    // before clicking Verify.
    notes: input.notes || undefined,
  };

  // Run the create input through the canonical schema so we share the
  // existing validation surface (lengths, URL shape, etc.).
  const parsedCreate = cipRecordCreateSchema.safeParse(draftInput);
  if (!parsedCreate.success) {
    const issue = parsedCreate.error.issues[0];
    return redirect(request, '/admin/shooters-world-cip/import', {
      error: `Invalid input: ${issue.path.join('.') || 'form'} — ${
        issue.message
      }`,
    });
  }

  try {
    const row = await createCipRecord(
      ctx.workspaceId,
      admin.email ?? null,
      parsedCreate.data,
    );
    const okParts = [
      `Draft created for ${row.cartridgeName}.`,
      'Status is DRAFT — transcribe Pmax, volumes, and rifling on the admin page, then verify against the source.',
    ];
    if (fetchWarning) {
      okParts.push(`Source fetch warning: ${fetchWarning}`);
    }
    return redirect(request, '/admin/shooters-world-cip', {
      ok: okParts.join(' '),
    });
  } catch (e) {
    return redirect(request, '/admin/shooters-world-cip/import', {
      error: e instanceof Error ? e.message : 'Failed to create draft row.',
    });
  }
}
