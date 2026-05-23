/**
 * Pressure-modeling input-completeness analysis.
 *
 * Inspects a Load (with its related cartridge, components, rifle, source, and
 * any range sessions) and reports which inputs a future, expert-validated
 * internal-ballistics model would need before its predictions could be
 * defensible.
 *
 * SAFETY:
 *   - This module performs NO pressure math.
 *   - It computes NO charge recommendations.
 *   - It makes NO safe/unsafe claim about any load.
 *   - It only reports presence/absence of fields, organized by category.
 */

export type ReadinessLevel = 'complete' | 'partial' | 'missing';

export type ReadinessItem = {
  key: string;
  label: string;
  present: boolean;
  detail?: string;
};

export type ReadinessCategory = {
  category: string;
  level: ReadinessLevel;
  items: ReadinessItem[];
};

export type ReadinessReport = {
  overall: ReadinessLevel;
  categories: ReadinessCategory[];
  // Total presence count, for UI summary only — not a "score" the user should
  // optimize against in lieu of expert review.
  presentCount: number;
  totalCount: number;
};

// Loose shape of the load + relations we accept. Kept structural so the
// helper does not pull a hard dependency on @prisma/client into client
// bundles that import this for typing.
export type ReadinessLoad = {
  id: string;
  chargeGr?: number | null;
  cartridgeOalIn?: number | null;
  cartridgeBaseToOgiveIn?: number | null;
  caseTrimLengthIn?: number | null;
  neckTensionThou?: number | null;
  cartridge?: {
    name?: string | null;
    caseCapacityGrH2O?: number | null;
    maxPressurePsi?: number | null;
    bulletDiameterIn?: number | null;
  } | null;
  bullet?: {
    manufacturer?: string | null;
    model?: string | null;
    bulletWeightGr?: number | null;
    bulletBc?: number | null;
  } | null;
  powder?: {
    manufacturer?: string | null;
    model?: string | null;
    burnRateLabel?: string | null;
    lotNumber?: string | null;
  } | null;
  primer?: {
    manufacturer?: string | null;
    model?: string | null;
  } | null;
  case_?: {
    manufacturer?: string | null;
    model?: string | null;
  } | null;
  rifle?: {
    barrelLengthIn?: number | null;
    twistRate?: string | null;
  } | null;
  source?: {
    title?: string | null;
    publishedMaxGr?: number | null;
  } | null;
  sessions?: Array<{
    tempF?: number | null;
    humidityPct?: number | null;
    pressureInHg?: number | null;
    avgVelocityFps?: number | null;
    esFps?: number | null;
    sdFps?: number | null;
    shotsFired?: number | null;
  }> | null;
};

function categoryLevel(items: ReadinessItem[]): ReadinessLevel {
  const total = items.length;
  if (total === 0) return 'missing';
  const present = items.filter((i) => i.present).length;
  if (present === 0) return 'missing';
  if (present === total) return 'complete';
  return 'partial';
}

function overallLevel(categories: ReadinessCategory[]): ReadinessLevel {
  if (categories.every((c) => c.level === 'complete')) return 'complete';
  if (categories.every((c) => c.level === 'missing')) return 'missing';
  return 'partial';
}

function present<T>(v: T | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

export function analyzeLoadReadiness(load: ReadinessLoad): ReadinessReport {
  const cartridge = load.cartridge ?? {};
  const bullet = load.bullet ?? {};
  const powder = load.powder ?? {};
  const primer = load.primer ?? {};
  const case_ = load.case_ ?? {};
  const rifle = load.rifle ?? {};
  const source = load.source ?? {};
  const sessions = load.sessions ?? [];
  const anyChrono = sessions.some(
    (s) => present(s.avgVelocityFps) || present(s.esFps) || present(s.sdFps),
  );
  const anyEnv = sessions.some(
    (s) =>
      present(s.tempF) || present(s.humidityPct) || present(s.pressureInHg),
  );

  const categories: ReadinessCategory[] = [
    {
      category: 'Cartridge & case',
      level: 'missing',
      items: [
        {
          key: 'caseCapacityGrH2O',
          label: 'Case capacity (gr H₂O)',
          present: present(cartridge.caseCapacityGrH2O),
        },
        {
          key: 'cartridgeBulletDiameter',
          label: 'Bullet diameter on cartridge ref',
          present: present(cartridge.bulletDiameterIn),
        },
        {
          key: 'caseTrimLengthIn',
          label: 'Case trim length',
          present: present(load.caseTrimLengthIn),
        },
        {
          key: 'caseComponent',
          label: 'Brass / case component',
          present: present(case_.manufacturer) || present(case_.model),
        },
      ],
    },
    {
      category: 'Bullet',
      level: 'missing',
      items: [
        {
          key: 'bulletWeightGr',
          label: 'Bullet weight (gr)',
          present: present(bullet.bulletWeightGr),
        },
        {
          key: 'bulletBc',
          label: 'Bullet BC',
          present: present(bullet.bulletBc),
        },
        {
          key: 'cartridgeOalIn',
          label: 'COAL (cartridge overall length)',
          present: present(load.cartridgeOalIn),
        },
        {
          key: 'cartridgeBaseToOgiveIn',
          label: 'CBTO (base-to-ogive)',
          present: present(load.cartridgeBaseToOgiveIn),
        },
      ],
    },
    {
      category: 'Powder',
      level: 'missing',
      items: [
        {
          key: 'powderIdentity',
          label: 'Powder identity (mfr + model)',
          present: present(powder.manufacturer) && present(powder.model),
        },
        {
          key: 'powderBurnLabel',
          label: 'Powder burn-rate label',
          present: present(powder.burnRateLabel),
        },
        {
          key: 'powderLot',
          label: 'Powder lot number',
          present: present(powder.lotNumber),
        },
      ],
    },
    {
      category: 'Primer & ignition',
      level: 'missing',
      items: [
        {
          key: 'primerIdentity',
          label: 'Primer identity (mfr + model)',
          present: present(primer.manufacturer) && present(primer.model),
        },
      ],
    },
    {
      category: 'Rifle / barrel',
      level: 'missing',
      items: [
        {
          key: 'barrelLengthIn',
          label: 'Barrel length (in)',
          present: present(rifle.barrelLengthIn),
        },
        {
          key: 'twistRate',
          label: 'Twist rate',
          present: present(rifle.twistRate),
        },
      ],
    },
    {
      category: 'Source citation',
      level: 'missing',
      items: [
        {
          key: 'sourceTitle',
          label: 'Cited published source',
          present: present(source.title),
        },
        {
          key: 'publishedMaxGr',
          label: 'Source max charge (gr)',
          present: present(source.publishedMaxGr),
        },
      ],
    },
    {
      category: 'Chronograph data',
      level: 'missing',
      items: [
        {
          key: 'chronoSession',
          label: 'At least one session with velocity stats',
          present: anyChrono,
        },
      ],
    },
    {
      category: 'Environmental data',
      level: 'missing',
      items: [
        {
          key: 'envSession',
          label: 'At least one session with temp / humidity / pressure',
          present: anyEnv,
        },
      ],
    },
    {
      category: 'Calibration / reference',
      level: 'missing',
      items: [
        {
          key: 'maxPressurePsi',
          label: 'Cartridge published MAP (psi)',
          present: present(cartridge.maxPressurePsi),
        },
      ],
    },
  ];

  for (const c of categories) {
    c.level = categoryLevel(c.items);
  }

  const allItems = categories.flatMap((c) => c.items);
  return {
    overall: overallLevel(categories),
    categories,
    presentCount: allItems.filter((i) => i.present).length,
    totalCount: allItems.length,
  };
}

// Solver readiness checklist independent of any specific load. Reports whether
// the project as a whole has the prerequisites a future expert-validated
// solver would need before it could be considered for enablement.
export type SolverReadinessItem = {
  key: string;
  label: string;
  status: 'planned' | 'in-progress' | 'blocked' | 'complete';
  detail?: string;
};

export function solverReadinessChecklist(): SolverReadinessItem[] {
  return [
    {
      key: 'inputs-cataloged',
      label: 'Required inputs cataloged',
      status: 'complete',
      detail:
        'Cartridge, bullet, powder, primer, barrel, environment, and reference fields are enumerated in the readiness analyzer.',
    },
    {
      key: 'validation-dataset',
      label: 'Validation dataset capture wired up',
      status: 'in-progress',
      detail:
        'PressureValidationRecord stores user-entered published or lab-measured reference rows. No computation reads from it.',
    },
    {
      key: 'model-registry',
      label: 'Model version registry',
      status: 'in-progress',
      detail:
        'PressureModelVersion records candidate model identities and their review status. Versions are documentation, not executables.',
    },
    {
      key: 'expert-review',
      label: 'External expert reviewer signed off',
      status: 'blocked',
      detail:
        'No solver may be enabled until a qualified ballistician + reloading-safety reviewer signs off on the methodology.',
    },
    {
      key: 'corpus-coverage',
      label: 'Pressure-tested corpus coverage threshold met',
      status: 'planned',
      detail:
        'A defined minimum coverage of pressure-tested published / lab data across cartridge × powder × bullet space is required.',
    },
    {
      key: 'variance-bounds',
      label: 'Variance bounds documented and approved',
      status: 'planned',
      detail:
        'Documented acceptable deviation between predicted and reference values must exist before any output can be displayed.',
    },
    {
      key: 'public-disablement',
      label: 'Public solver outputs remain disabled',
      status: 'complete',
      detail:
        'No route or component in this app computes or displays pressure predictions. The test bench surfaces only readiness state.',
    },
  ];
}
