// Reference data quality analysis.
//
// Pure functions that examine records pulled from Prisma and report
// missing/needs-review/duplicate-looking findings. Nothing here interprets
// pressure, charge weight, or load safety — findings are presented as
// data-completeness signals only, never as safety verdicts.

export type Severity = 'info' | 'warning' | 'critical';

export type DataQualityFinding = {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  detail: string;
  entityType: string;
  entityId: string | null;
  fixHref: string | null;
};

export type SourceConfidenceKind =
  | 'manufacturer-published'
  | 'user-entered'
  | 'chrono-observed'
  | 'imported'
  | 'verified'
  | 'needs-review'
  | 'rejected'
  | 'validation-only';

export type Categorized<T> = { category: string; items: T[] };

type LoadRecord = {
  id: string;
  name: string;
  chargeGr: number | null;
  cartridgeOalIn: number | null;
  safetyAcknowledged: boolean;
  sourceId: string | null;
  sourcePageLabel: string | null;
  status: string;
  updatedAt: Date;
};

type SourceRecord = {
  id: string;
  title: string;
  publisher: string | null;
  edition: string | null;
  citation: string | null;
  publishedYear: number | null;
};

type ComponentRecord = {
  id: string;
  kind: 'BULLET' | 'POWDER' | 'PRIMER' | 'CASE';
  manufacturer: string;
  model: string;
  bulletWeightGr: number | null;
  bulletBc: number | null;
  burnRateLabel: string | null;
  lotNumber: string | null;
};

type PublishedRowRecord = {
  id: string;
  status: 'DRAFT' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';
  pageLabel: string | null;
  sourceId: string | null;
  bulletWeightGr: number | null;
  chargeGr: number | null;
  velocityFps: number | null;
  bulletName: string | null;
  powderName: string | null;
  updatedAt: Date;
};

type RangeSessionRecord = {
  id: string;
  loadId: string | null;
  date: Date;
  avgVelocityFps: number | null;
  shotsFired: number | null;
  sdFps: number | null;
  esFps: number | null;
};

type SolverDataRecord = {
  id: string;
  kind: 'CaseCapacity' | 'BulletDim' | 'PowderMeta' | 'BarrelGeom' | 'ChronoCal';
  label: string;
  missing: string[];
  updatedAt: Date;
  hrefBase: string;
};

type ValidationDatasetRecord = {
  id: string;
  name: string;
  status: string;
  caseCount: number;
  runCount: number;
  acknowledgedValidationOnly: boolean;
  updatedAt: Date;
};

export type DataQualityInput = {
  loads: LoadRecord[];
  sources: SourceRecord[];
  components: ComponentRecord[];
  publishedRows: PublishedRowRecord[];
  rangeSessions: RangeSessionRecord[];
  solverData: SolverDataRecord[];
  validationDatasets: ValidationDatasetRecord[];
};

export function analyzeDataQuality(input: DataQualityInput): {
  findings: DataQualityFinding[];
  summary: { total: number; bySeverity: Record<Severity, number>; byCategory: Record<string, number> };
} {
  const findings: DataQualityFinding[] = [];

  for (const load of input.loads) {
    if (!load.sourceId) {
      findings.push({
        id: `load-${load.id}-no-source`,
        category: 'Loads',
        severity: 'warning',
        title: `Load "${load.name}" has no source citation`,
        detail:
          'Charge-bearing loads should cite a verified published source. Open the load to attach one before printing or sharing.',
        entityType: 'Load',
        entityId: load.id,
        fixHref: `/loads/${load.id}`,
      });
    } else if (!load.sourcePageLabel) {
      findings.push({
        id: `load-${load.id}-no-page`,
        category: 'Loads',
        severity: 'info',
        title: `Load "${load.name}" missing page label for source`,
        detail:
          'Add a specific page or section reference so the citation is traceable.',
        entityType: 'Load',
        entityId: load.id,
        fixHref: `/loads/${load.id}`,
      });
    }
    if (
      (load.chargeGr ?? null) != null &&
      !load.safetyAcknowledged
    ) {
      findings.push({
        id: `load-${load.id}-unack`,
        category: 'Loads',
        severity: 'critical',
        title: `Load "${load.name}" charge entered without safety acknowledgement`,
        detail:
          'The shooter-responsibility checkbox is required before a charge-bearing load can be considered ready.',
        entityType: 'Load',
        entityId: load.id,
        fixHref: `/loads/${load.id}`,
      });
    }
    if (load.chargeGr == null && load.status === 'LOADED') {
      findings.push({
        id: `load-${load.id}-no-charge`,
        category: 'Loads',
        severity: 'warning',
        title: `Load "${load.name}" marked LOADED with no charge`,
        detail:
          'Status is LOADED but no charge weight is recorded. Record the charge or revert status.',
        entityType: 'Load',
        entityId: load.id,
        fixHref: `/loads/${load.id}`,
      });
    }
  }

  for (const src of input.sources) {
    const missing: string[] = [];
    if (!src.publisher) missing.push('publisher');
    if (!src.edition) missing.push('edition');
    if (!src.publishedYear) missing.push('publishedYear');
    if (!src.citation) missing.push('citation');
    if (missing.length > 0) {
      findings.push({
        id: `source-${src.id}-incomplete`,
        category: 'Sources',
        severity: missing.includes('citation') ? 'warning' : 'info',
        title: `Source "${src.title}" missing ${missing.join(', ')}`,
        detail:
          'Citations should include publisher, edition, year, and a page or section. Incomplete sources make loads less defensible.',
        entityType: 'Source',
        entityId: src.id,
        fixHref: '/sources',
      });
    }
  }

  const seenSources = new Map<string, string[]>();
  for (const src of input.sources) {
    const key = `${(src.title ?? '').trim().toLowerCase()}|${(src.publisher ?? '').trim().toLowerCase()}`;
    if (!seenSources.has(key)) seenSources.set(key, []);
    seenSources.get(key)!.push(src.id);
  }
  for (const [key, ids] of seenSources) {
    if (ids.length > 1 && key.replace(/\|+/g, '').length > 0) {
      findings.push({
        id: `source-dup-${ids.join('-')}`,
        category: 'Sources',
        severity: 'info',
        title: `Possible duplicate sources (${ids.length} rows)`,
        detail:
          'Two or more sources have the same title and publisher. Consider consolidating to avoid divergent citations.',
        entityType: 'Source',
        entityId: ids[0],
        fixHref: '/sources',
      });
    }
  }

  for (const c of input.components) {
    if (c.kind === 'BULLET' && c.bulletWeightGr == null) {
      findings.push({
        id: `component-${c.id}-no-weight`,
        category: 'Components',
        severity: 'warning',
        title: `${c.manufacturer} ${c.model}: bullet weight missing`,
        detail:
          'Bullet weight is needed for downrange ballistics estimates. Record the grain weight.',
        entityType: 'Component',
        entityId: c.id,
        fixHref: `/components/${c.id}`,
      });
    }
    if (c.kind === 'BULLET' && c.bulletBc == null) {
      findings.push({
        id: `component-${c.id}-no-bc`,
        category: 'Components',
        severity: 'info',
        title: `${c.manufacturer} ${c.model}: ballistic coefficient missing`,
        detail:
          'BC G1 is needed for trajectory estimates. Look it up on the manufacturer page.',
        entityType: 'Component',
        entityId: c.id,
        fixHref: `/components/${c.id}`,
      });
    }
    if (c.kind === 'POWDER' && !c.burnRateLabel) {
      findings.push({
        id: `component-${c.id}-no-burn`,
        category: 'Components',
        severity: 'info',
        title: `${c.manufacturer} ${c.model}: burn rate label missing`,
        detail:
          'A canonical burn rate label (e.g. "H4350") helps cross-reference published data.',
        entityType: 'Component',
        entityId: c.id,
        fixHref: `/components/${c.id}`,
      });
    }
    if (!c.lotNumber) {
      findings.push({
        id: `component-${c.id}-no-lot`,
        category: 'Components',
        severity: 'info',
        title: `${c.manufacturer} ${c.model}: lot number missing`,
        detail:
          'Recording a lot number lets you trace any change in observed velocity back to a specific can/box.',
        entityType: 'Component',
        entityId: c.id,
        fixHref: `/components/${c.id}`,
      });
    }
  }

  for (const row of input.publishedRows) {
    if (row.status === 'NEEDS_REVIEW') {
      findings.push({
        id: `pubrow-${row.id}-needs-review`,
        category: 'Published rows',
        severity: 'warning',
        title: `Published row needs review`,
        detail: `${row.bulletName ?? '?'} / ${row.powderName ?? '?'} — verify against the original document before citing on a load.`,
        entityType: 'PublishedLoadRowDraft',
        entityId: row.id,
        fixHref: '/published-data-review',
      });
    }
    if (row.status === 'DRAFT' && !row.pageLabel) {
      findings.push({
        id: `pubrow-${row.id}-no-page`,
        category: 'Published rows',
        severity: 'info',
        title: 'Published row missing page label',
        detail:
          'A page or section label keeps the transcription traceable to the original document.',
        entityType: 'PublishedLoadRowDraft',
        entityId: row.id,
        fixHref: '/published-data-review',
      });
    }
    if (row.status === 'DRAFT' && row.chargeGr == null && row.velocityFps == null) {
      findings.push({
        id: `pubrow-${row.id}-empty`,
        category: 'Published rows',
        severity: 'info',
        title: 'Published row has no charge or velocity recorded',
        detail:
          'Draft rows without charge or velocity contribute nothing to a citation — complete or remove.',
        entityType: 'PublishedLoadRowDraft',
        entityId: row.id,
        fixHref: '/published-data-review',
      });
    }
  }

  for (const s of input.rangeSessions) {
    if (s.shotsFired != null && s.shotsFired > 0 && s.avgVelocityFps == null) {
      findings.push({
        id: `session-${s.id}-no-avg`,
        category: 'Range sessions',
        severity: 'info',
        title: 'Range session has shots fired but no average velocity',
        detail:
          'Add a chronograph average or import shots via /chrono-import for a complete record.',
        entityType: 'RangeSession',
        entityId: s.id,
        fixHref: '/sessions',
      });
    }
    if (!s.loadId) {
      findings.push({
        id: `session-${s.id}-no-load`,
        category: 'Range sessions',
        severity: 'info',
        title: 'Range session not linked to a load',
        detail:
          'Linking a session to a load keeps the chrono summary anchored to the recipe under test.',
        entityType: 'RangeSession',
        entityId: s.id,
        fixHref: '/sessions',
      });
    }
  }

  for (const sd of input.solverData) {
    if (sd.missing.length > 0) {
      findings.push({
        id: `solver-${sd.kind}-${sd.id}`,
        category: 'Solver inputs',
        severity: 'info',
        title: `${sd.kind} record incomplete: ${sd.label}`,
        detail: `Missing: ${sd.missing.join(', ')}. Solver-input records are not required for normal use; complete them only if you are participating in pressure-engine validation.`,
        entityType: sd.kind,
        entityId: sd.id,
        fixHref: sd.hrefBase,
      });
    }
  }

  for (const ds of input.validationDatasets) {
    if (!ds.acknowledgedValidationOnly) {
      findings.push({
        id: `vds-${ds.id}-no-ack`,
        category: 'Validation datasets',
        severity: 'warning',
        title: `Dataset "${ds.name}" missing validation-only acknowledgement`,
        detail:
          'Validation datasets must be explicitly acknowledged as validation-only. Open the dataset and confirm before adding cases.',
        entityType: 'ModelValidationDataset',
        entityId: ds.id,
        fixHref: `/admin/model-validation/${ds.id}`,
      });
    }
    if (ds.caseCount === 0) {
      findings.push({
        id: `vds-${ds.id}-empty`,
        category: 'Validation datasets',
        severity: 'info',
        title: `Dataset "${ds.name}" has no reference cases`,
        detail:
          'Add at least one transcribed reference case before running the harness against this dataset.',
        entityType: 'ModelValidationDataset',
        entityId: ds.id,
        fixHref: `/admin/model-validation/${ds.id}`,
      });
    }
  }

  const bySeverity: Record<Severity, number> = { info: 0, warning: 0, critical: 0 };
  const byCategory: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }

  return { findings, summary: { total: findings.length, bySeverity, byCategory } };
}

export function confidenceLabel(kind: SourceConfidenceKind): string {
  switch (kind) {
    case 'manufacturer-published':
      return 'Manufacturer-published';
    case 'user-entered':
      return 'User-entered';
    case 'chrono-observed':
      return 'Chrono-observed';
    case 'imported':
      return 'Imported';
    case 'verified':
      return 'Verified';
    case 'needs-review':
      return 'Needs review';
    case 'rejected':
      return 'Rejected';
    case 'validation-only':
      return 'Validation-only';
  }
}
