import { NextRequest } from 'next/server';
import { getAdminContext } from '@/lib/auth/admin';
import { csvResponse, csvUnavailable, type CsvValue } from '@/lib/data/csv';

// /api/admin/model-validation/template/[kind]
//
// Downloadable CSV templates for the admin model validation harness. Each
// template has clearly-labelled headers and an example row that contains
// only generic, non-copyrighted reference metadata so the admin can adapt
// it for their own validation work. No published load tables are bundled.

export const dynamic = 'force-dynamic';

type Template = {
  filename: string;
  headers: string[];
  exampleRows: CsvValue[][];
};

// Keep example data plausibly representative but obviously synthetic. The
// numbers are not from any published manual — they are illustrative only.
const TEMPLATES: Record<string, Template> = {
  dataset: {
    filename: 'model-validation-dataset-template.csv',
    headers: [
      'name',
      'kind',
      'description',
      'referenceIdentifier',
      'licenseNote',
      'acknowledgedValidationOnly',
    ],
    exampleRows: [
      [
        'Example reference dataset',
        'PUBLISHED',
        'Replace with the name of the published manual / manufacturer / lab dataset.',
        'DOI or page reference (e.g. "Manual 2024 ed. p. 142")',
        'Attribution and reuse terms — confirm with the original publisher.',
        'true',
      ],
      [
        'Manufacturer engineering data',
        'MANUFACTURER',
        'Engineering data sheet shared by the bullet/powder manufacturer.',
        'Vendor doc id',
        'Internal-use only unless redistribution rights are obtained.',
        'true',
      ],
      [
        'Internal pressure-trace lab run',
        'LAB',
        'Internal pressure-trace lab run. Reference pressure stays admin-only.',
        'Lab report id',
        'Confidential.',
        'true',
      ],
    ],
  },
  cases: {
    filename: 'model-validation-cases-template.csv',
    // Cases header per operator spec. Columns map to:
    //   CALIBER        → cartridge / caliber label (e.g. "6.5 Creedmoor")
    //   CASEWEIGHT     → reference charge weight, grains (admin metadata only)
    //   PROJECTILECOAL → projectile + cartridge overall length context
    //   LOADST         → starting reference load label (e.g. "start")
    //   VELMAX         → reference velocity (first column), fps
    //   LOADMAX        → max reference load label (e.g. "max charge")
    //   VELMAX         → observed velocity at max (second column), fps —
    //                    duplicate header name is intentional per spec.
    //                    The CSV is scaffolding for hand-transcription; the
    //                    importer is JSON-based and does not parse this CSV
    //                    by column name, so the duplicate is safe here.
    //   PSI            → reference pressure (psi). ADMIN-ONLY validation
    //                    metadata. Never rendered as load guidance and never
    //                    compared against any prediction. Leave blank for
    //                    velocity-only datasets.
    headers: [
      'CALIBER',
      'CASEWEIGHT',
      'PROJECTILECOAL',
      'LOADST',
      'VELMAX',
      'LOADMAX',
      'VELMAX',
      'PSI',
    ],
    exampleRows: [
      // Synthetic, illustrative numbers ONLY. Not from any published manual.
      // Do NOT treat these as load guidance.
      [
        '6.5 Creedmoor',
        'EXAMPLE — replace',
        '140gr / 2.825 in COAL (illustrative)',
        'start (illustrative)',
        2650,
        'max (illustrative)',
        2820,
        '',
      ],
      [
        '.308 Winchester',
        'EXAMPLE — replace',
        '168gr / 2.800 in COAL (illustrative)',
        'start (illustrative)',
        2480,
        'max (illustrative)',
        2630,
        '',
      ],
    ],
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const admin = await getAdminContext();
  if (!admin.isAdmin) {
    return new Response('Forbidden — admin-only template.', { status: 403 });
  }
  const { kind } = await params;
  const tpl = TEMPLATES[kind];
  if (!tpl) {
    return csvUnavailable(`Unknown template kind: ${kind}`);
  }
  return csvResponse(tpl.filename, tpl.headers, tpl.exampleRows);
}
