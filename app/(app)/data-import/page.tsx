import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataImportWizard } from '@/components/forms/DataImportWizard';
import type { WizardCategory } from '@/lib/data/importWizardParse';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: WizardCategory[] = [
  'published',
  'chrono',
  'inventory',
  'caseCapacity',
  'bulletMeta',
  'powderMeta',
];

// Guided Data Import Wizard.
//
// One place to paste/import core data for a beginner. Routes pasted text to
// the right existing pipeline (published-data review staging, chrono import,
// component inventory, solver-input records). This page does NOT compute
// pressure, recommend charges, or label any row as safe/unsafe. Published-
// manual rows are staged for verification — never auto-marked safe.

export default async function DataImportPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const raw = sp?.category;
  const initial: WizardCategory | undefined =
    raw && (VALID_CATEGORIES as string[]).includes(raw)
      ? (raw as WizardCategory)
      : undefined;

  return (
    <>
      <Topbar
        title="Guided data import"
        actions={<Badge tone="accent">Beginner-friendly</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="One place to paste your data"
            description="Pick a data type, paste CSV/TSV, preview parsed rows, and save. Each category routes to the right page or creates real records — never load advice."
          />
          <CardBody>
            <ul className="text-[12px] text-text-muted leading-relaxed list-disc pl-5 space-y-1 mb-4">
              <li>
                Published manual rows land in{' '}
                <Link
                  href="/published-data-review"
                  className="text-accent hover:text-accent-hover"
                >
                  Published-data review
                </Link>{' '}
                as <em>needs review</em> — never auto-verified, never marked
                safe.
              </li>
              <li>
                Chronograph CSV routes to the existing{' '}
                <Link
                  href="/chrono-import"
                  className="text-accent hover:text-accent-hover"
                >
                  Chrono import
                </Link>{' '}
                page where it becomes a range session.
              </li>
              <li>
                Component inventory creates real{' '}
                <Link
                  href="/components"
                  className="text-accent hover:text-accent-hover"
                >
                  Component
                </Link>{' '}
                records (bullets, powders, primers, cases) with quantity on
                hand — recordkeeping only.
              </li>
              <li>
                Case capacity, bullet metadata, and powder metadata are stored
                under{' '}
                <Link
                  href="/solver-inputs"
                  className="text-accent hover:text-accent-hover"
                >
                  Solver inputs
                </Link>
                . They are measurements and metadata only — nothing reads from
                them to compute pressure today.
              </li>
            </ul>
            <DataImportWizard initial={initial} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              LoadBench Pro does not predict pressure, recommend charges, or
              label any row as safe or unsafe. Imported published-manual data
              must be verified by a workspace member against the original
              source document before being cited on a load — and even then a
              charge-bearing load still requires its normal source citation and
              safety acknowledgement. See the{' '}
              <Link
                href="/safety"
                className="text-accent hover:text-accent-hover"
              >
                safety policy
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
