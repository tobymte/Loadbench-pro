import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

// This page is intentionally a roadmap/scaffold. It does NOT compute pressure,
// recommend charges, or imply safety. No solver is wired up; inputs below are
// disabled and exist only to communicate what a future, expert-validated tool
// would need to ingest.

const REQUIRED_INPUTS: Array<{ group: string; items: string[] }> = [
  {
    group: 'Cartridge & case',
    items: [
      'Case capacity (gr H₂O) for the specific brass + sizing condition',
      'Headspace and shoulder datum',
      'Case wall taper and web thickness assumptions',
    ],
  },
  {
    group: 'Bullet',
    items: [
      'Bullet diameter, weight, bearing-surface length',
      'Ogive profile and tangent/secant geometry',
      'Seating depth (CBTO) and freebore engagement',
    ],
  },
  {
    group: 'Bore & barrel',
    items: [
      'Bore and groove dimensions',
      'Throat geometry, leade angle',
      'Barrel length and twist',
    ],
  },
  {
    group: 'Powder',
    items: [
      'Manufacturer-supplied burn-rate / progressivity characterization',
      'Density and lot-specific calibration',
      'Temperature sensitivity coefficient',
    ],
  },
  {
    group: 'Primer & ignition',
    items: [
      'Primer model and brisance class',
      'Start-pressure assumption appropriate for the case/bullet',
    ],
  },
  {
    group: 'Environment & calibration',
    items: [
      'Ambient temperature',
      'Chronograph data from observed loads (for calibration only, not safety)',
      'Cross-references to pressure-tested published data',
    ],
  },
];

const MILESTONES: Array<{
  step: string;
  title: string;
  status: 'planned' | 'blocked' | 'future';
  description: string;
}> = [
  {
    step: 'M1',
    title: 'Data model for pressure-relevant inputs',
    status: 'planned',
    description:
      'Add structured columns for case capacity, throat geometry, bullet bearing surface, and powder calibration metadata. Recordkeeping only — no computation.',
  },
  {
    step: 'M2',
    title: 'Calibration record store',
    status: 'planned',
    description:
      'Capture chronograph + pressure-tested reference data so any future model can be checked against observed reality before it is allowed to display anything.',
  },
  {
    step: 'M3',
    title: 'Non-authoritative simulation sandbox',
    status: 'blocked',
    description:
      'A clearly-labeled, isolated sandbox a user could run hypotheticals in. Outputs would be unsigned, non-numeric, and never presented as a load recommendation. Blocked on expert review.',
  },
  {
    step: 'M4',
    title: 'Validation suite',
    status: 'future',
    description:
      'Automated comparison against an authoritative published-load corpus with documented variance bounds. Failures would gate the entire feature off.',
  },
  {
    step: 'M5',
    title: 'Expert review & sign-off',
    status: 'future',
    description:
      'External ballistician + reloading-safety review of inputs, calibration, and presentation. Without sign-off, the feature stays disabled in production.',
  },
];

const DISABLED_INPUTS = [
  { label: 'Case capacity (gr H₂O)', placeholder: 'e.g. 52.5' },
  { label: 'Bullet weight (gr)', placeholder: 'e.g. 140' },
  { label: 'Bullet bearing-surface (in)', placeholder: 'e.g. 0.380' },
  { label: 'Seating depth CBTO (in)', placeholder: 'e.g. 2.230' },
  { label: 'Bore diameter (in)', placeholder: 'e.g. 0.264' },
  { label: 'Barrel length (in)', placeholder: 'e.g. 24' },
  { label: 'Powder lot calibration ref', placeholder: 'lot id' },
  { label: 'Primer model', placeholder: 'e.g. CCI BR-2' },
  { label: 'Ambient temperature (°F)', placeholder: 'e.g. 60' },
  { label: 'Start-pressure assumption (psi)', placeholder: 'expert-set' },
];

export default function PressureModelingPage() {
  return (
    <>
      <Topbar
        title="Pressure Modeling Lab"
        actions={<Badge tone="danger">Disabled in MVP</Badge>}
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        <Card>
          <CardHeader
            title="Why this is disabled"
            description="Why LoadBench Pro will not ship a working internal-ballistics solver in its current state."
          />
          <CardBody>
            <p className="text-sm text-text-muted leading-relaxed">
              Tools like QuickLOAD and GRT are useful in expert hands, but they
              are <strong>predictions</strong> that depend on accurate inputs,
              lot-specific calibration, and a user who understands their
              uncertainty. A general-purpose “safe load” calculator embedded in
              a notebook app is a hazard, not a feature. We are intentionally
              keeping LoadBench Pro on the recordkeeping side of that line.
            </p>
            <ul className="mt-4 text-sm text-text-muted leading-relaxed list-disc pl-5 space-y-1">
              <li>
                We do <strong>not</strong> compute internal pressure.
              </li>
              <li>
                We do <strong>not</strong> recommend charge weights, COAL, or
                seating depth.
              </li>
              <li>
                We do <strong>not</strong> propose powder substitutions.
              </li>
              <li>
                We do <strong>not</strong> mark any load as “safe” or “unsafe.”
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Required inputs for a future, validated model"
            description="What a real internal-ballistics solver would need to ingest before any output could be defensible."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {REQUIRED_INPUTS.map((group) => (
                <div key={group.group}>
                  <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2">
                    {group.group}
                  </div>
                  <ul className="text-sm text-text-muted leading-relaxed list-disc pl-5 space-y-1">
                    {group.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Input checklist (read-only)"
            description="The shape of the input form a future solver would expose. All fields are disabled — nothing is computed or stored from this page."
            actions={<Badge tone="warning">Read-only</Badge>}
          />
          <CardBody>
            <fieldset disabled className="opacity-60 pointer-events-none">
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                data-testid="pressure-modeling-disabled-inputs"
              >
                {DISABLED_INPUTS.map((f) => (
                  <div key={f.label}>
                    <label htmlFor={`pm-${f.label}`}>{f.label}</label>
                    <input
                      id={`pm-${f.label}`}
                      placeholder={f.placeholder}
                      disabled
                      aria-disabled="true"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            <p className="mt-4 text-[12px] text-text-faint">
              Disabled by design. There is no submit action. There is no
              computation. There is no output.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Validation workflow (planned)"
            description="How outputs would be checked before any user could see them."
          />
          <CardBody>
            <ol className="text-sm text-text-muted leading-relaxed list-decimal pl-5 space-y-2">
              <li>
                Maintain a curated corpus of pressure-tested published loads
                from primary manufacturers and laboratories.
              </li>
              <li>
                For every candidate model run, compare predicted velocity and
                pressure against the corpus and against the user’s logged
                chronograph data — never the other way around.
              </li>
              <li>
                Reject any prediction whose deviation exceeds documented
                variance bounds; show calibration failure, not numbers.
              </li>
              <li>
                Require expert reviewers to sign off on the calibration
                methodology before the feature is enabled in production.
              </li>
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Safety boundaries"
            description="Lines this feature will not cross, even once enabled."
          />
          <CardBody>
            <ul className="text-sm text-text-muted leading-relaxed list-disc pl-5 space-y-1">
              <li>No load recommendations.</li>
              <li>No safe / unsafe claims.</li>
              <li>
                No pressure predictions outside a clearly-labeled,
                expert-validated calibration envelope.
              </li>
              <li>
                No removal of the requirement that the user cite a published
                source for any charge-bearing load (see{' '}
                <Link
                  href="/safety"
                  className="text-accent hover:text-accent-hover"
                >
                  safety policy
                </Link>
                ).
              </li>
              <li>
                No suggestion that this app replaces independent pressure
                testing, manufacturer data, or expert review.
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Planned milestones"
            description="How and in what order pressure-modeling capability would be built — if it is built at all."
          />
          <CardBody>
            <div className="space-y-4">
              {MILESTONES.map((m) => (
                <div
                  key={m.step}
                  className="border-l-2 border-border pl-4 py-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-text-faint font-medium">
                      {m.step}
                    </span>
                    <span className="text-sm font-semibold text-text">
                      {m.title}
                    </span>
                    <Badge
                      tone={
                        m.status === 'planned'
                          ? 'accent'
                          : m.status === 'blocked'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {m.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-text-muted leading-relaxed">
                    {m.description}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-[11px] text-text-faint leading-relaxed">
              This page is a roadmap and a safety boundary, not a tool. It does
              not predict pressure, recommend charges, or certify any load.
              Until expert validation, calibration data, and a passing
              validation suite are all in place, no solver will be exposed
              here.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
