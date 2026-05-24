import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getAdminContext } from '@/lib/auth/admin';

// /admin/model-validation/templates
//
// Admin-only templates page for the model validation harness. Provides
// downloadable CSV templates with safe, illustrative example rows and the
// header definitions the admin should follow when transcribing reference
// data from a licensed source or a controlled lab.
//
// What this page is NOT: a load data dump. It contains zero copyrighted
// load tables — only generic CSV scaffolding and column definitions.

export const dynamic = 'force-dynamic';

const DATASET_FIELDS: Array<{ name: string; required: boolean; description: string }> = [
  { name: 'name', required: true, description: 'Short display name for the dataset.' },
  {
    name: 'kind',
    required: true,
    description:
      'One of PUBLISHED, MANUFACTURER, LAB, INTERNAL_TEST. Drives badging in the harness UI.',
  },
  {
    name: 'description',
    required: false,
    description: 'Free-form context: where the data came from and what it covers.',
  },
  {
    name: 'referenceIdentifier',
    required: false,
    description:
      'A DOI, manual page reference, lab report id, vendor data-sheet id — anything that uniquely points back to the source.',
  },
  {
    name: 'licenseNote',
    required: false,
    description:
      'License / attribution / reuse terms. Confirm with the publisher before redistributing.',
  },
  {
    name: 'acknowledgedValidationOnly',
    required: true,
    description:
      'Must be true. Records that this dataset is admin reference metadata, never load guidance.',
  },
];

const CASE_FIELDS: Array<{ name: string; required: boolean; description: string }> = [
  { name: 'label', required: true, description: 'Short case label (e.g. "Run #4, 70°F").' },
  { name: 'cartridgeName', required: false, description: 'e.g. "6.5 Creedmoor".' },
  { name: 'bulletWeightGr', required: false, description: 'Grains.' },
  { name: 'bulletDiameterIn', required: false, description: 'Inches (e.g. 0.264).' },
  { name: 'chargeGr', required: false, description: 'Charge weight in grains.' },
  { name: 'caseCapacityGrH2O', required: false, description: 'Water grains.' },
  { name: 'barrelLengthIn', required: false, description: 'Inches.' },
  { name: 'twistRate', required: false, description: 'e.g. "1:8".' },
  { name: 'cartridgeOalIn', required: false, description: 'Cartridge overall length, inches.' },
  {
    name: 'powderBurnRateLabel',
    required: false,
    description: 'Generic burn-rate descriptor — avoid brand-specific copyrighted names.',
  },
  { name: 'tempF', required: false, description: 'Test temperature in °F.' },
  {
    name: 'referenceVelocityFps',
    required: false,
    description: 'Reference velocity from the source. Displayed in the harness.',
  },
  {
    name: 'referencePressurePsi',
    required: false,
    description:
      'Reference pressure from the source. Admin-only metadata — never rendered as load guidance and never compared against any prediction. Leave blank for velocity-only datasets.',
  },
  {
    name: 'observedVelocityFps',
    required: false,
    description: 'Optional observed velocity (lab or chrono) used for the harness velocity delta.',
  },
  { name: 'pageLabel', required: false, description: 'Source page / table / row reference.' },
  { name: 'notes', required: false, description: 'Free-form notes.' },
];

export default async function ValidationTemplatesPage() {
  const admin = await getAdminContext();

  if (!admin.isAdmin) {
    return (
      <>
        <Topbar
          title="Validation templates"
          actions={<Badge tone="danger">Operator-only</Badge>}
        />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Card>
            <CardHeader
              title="Operator-only"
              description="Validation dataset templates and admin import helpers are restricted to operators."
            />
            <CardBody>
              <p className="text-[12px] text-text-muted">
                {admin.reason ?? 'You are not authorized to view this page.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Validation dataset templates"
        actions={<Badge tone="warning">Operator-only</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader
            title="Safe data entry for the model validation harness"
            description="These CSV templates and field definitions let you transcribe reference data from a licensed source or a controlled lab without re-distributing copyrighted load tables. The example rows are illustrative — replace them before importing."
          />
          <CardBody>
            <ul className="list-disc pl-5 text-[12px] text-text-muted leading-relaxed space-y-1.5">
              <li>
                Do not paste copyrighted load tables verbatim. Transcribe only
                the fields you need to validate an adapter against a specific
                reference case.
              </li>
              <li>
                Always set <code className="text-accent">acknowledgedValidationOnly = true</code> on
                the dataset row. The harness refuses to display rows without it.
              </li>
              <li>
                Cite the source on every dataset with{' '}
                <code className="text-accent">referenceIdentifier</code> and{' '}
                <code className="text-accent">licenseNote</code>.
              </li>
              <li>
                <code className="text-accent">referencePressurePsi</code> is optional.
                Leave it blank for velocity-only datasets — it is admin-only
                governance metadata and is never rendered as guidance.
              </li>
              <li>
                Pressure prediction is permanently disabled. These templates
                exist to validate adapters against reference data, not to
                produce predictions.
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Download templates"
            description="Open in Excel, Numbers, Google Sheets, or any text editor."
            actions={
              <Link
                href="/admin/model-validation"
                className="text-[12px] text-accent hover:text-accent-hover"
              >
                Back to harness →
              </Link>
            }
          />
          <CardBody className="flex flex-wrap gap-2">
            <Link href="/api/admin/model-validation/template/dataset">
              <Button>Dataset header CSV</Button>
            </Link>
            <Link href="/api/admin/model-validation/template/cases">
              <Button>Cases header CSV</Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Dataset CSV — field reference" />
          <CardBody className="!p-0">
            <FieldTable fields={DATASET_FIELDS} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cases CSV — field reference" />
          <CardBody className="!p-0">
            <FieldTable fields={CASE_FIELDS} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recommended workflow"
            description="A short checklist for transcribing a new validation dataset."
          />
          <CardBody>
            <ol className="list-decimal pl-5 text-[12px] text-text-muted leading-relaxed space-y-1">
              <li>Download the dataset and cases templates.</li>
              <li>
                Fill in the dataset row first — set <code className="text-accent">kind</code>,
                attribution, and acknowledgement.
              </li>
              <li>
                Transcribe one row per case in the cases CSV. Keep
                identifiers (label, page reference) so the harness can show
                where each case came from.
              </li>
              <li>
                Save both files privately. Do not commit copyrighted reference
                data to the repository.
              </li>
              <li>
                Import them into the harness once an admin-only importer is
                wired up. Until then, transcribe rows into the harness UI by hand.
              </li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function FieldTable({
  fields,
}: {
  fields: Array<{ name: string; required: boolean; description: string }>;
}) {
  return (
    <ul className="divide-y divide-border text-[12px]">
      {fields.map((f) => (
        <li key={f.name} className="px-5 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2">
          <div className="sm:w-56 shrink-0 flex items-center gap-2">
            <code className="text-text">{f.name}</code>
            {f.required ? (
              <Badge tone="warning">required</Badge>
            ) : (
              <Badge tone="neutral">optional</Badge>
            )}
          </div>
          <div className="text-text-muted flex-1">{f.description}</div>
        </li>
      ))}
    </ul>
  );
}
