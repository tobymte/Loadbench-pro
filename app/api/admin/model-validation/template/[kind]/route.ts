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
    headers: [
      'label',
      'cartridgeName',
      'bulletWeightGr',
      'bulletDiameterIn',
      'chargeGr',
      'caseCapacityGrH2O',
      'barrelLengthIn',
      'twistRate',
      'cartridgeOalIn',
      'powderBurnRateLabel',
      'tempF',
      'referenceVelocityFps',
      'referencePressurePsi',
      'observedVelocityFps',
      'pageLabel',
      'notes',
    ],
    exampleRows: [
      [
        'EXAMPLE — replace before import',
        '6.5 Creedmoor',
        140,
        0.264,
        // Synthetic numbers. Replace with the values from your cited dataset.
        41.5,
        53.5,
        24,
        '1:8',
        2.825,
        'medium (e.g. H4350-class)',
        70,
        2820,
        // referencePressurePsi is OPTIONAL admin-only reference metadata. It
        // is never rendered as load guidance and never compared against any
        // prediction. Leave blank if your dataset is velocity-only.
        '',
        2812,
        'p. 142, row 4',
        'Replace this row with real reference data. The example values are illustrative only — do not load.',
      ],
      [
        'EXAMPLE — second row',
        '.308 Winchester',
        168,
        0.308,
        42.0,
        56.0,
        20,
        '1:10',
        2.800,
        'medium (e.g. Varget-class)',
        70,
        2630,
        '',
        2641,
        'p. 215, row 2',
        'Replace before import.',
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
