// Aggregations for the load comparison view. Pure aggregation over
// user-entered observations — no predictions, no recommendations,
// no safety judgement.

export type CompareSessionInput = {
  date: Date;
  avgVelocityFps: number | null;
  esFps: number | null;
  sdFps: number | null;
  groupSizeIn: number | null;
  groupDistanceYd: number | null;
};

export type CompareLoadInput = {
  id: string;
  name: string;
  status: string;
  chargeGr: number | null;
  safetyAcknowledged: boolean;
  cartridge: { id: string; name: string } | null;
  bullet: { id: string; manufacturer: string; model: string } | null;
  powder: { id: string; manufacturer: string; model: string } | null;
  rifle: { id: string; name: string } | null;
  source: { id: string; title: string } | null;
  sessions: CompareSessionInput[];
};

export type CompareRow = {
  loadId: string;
  loadName: string;
  status: string;
  chargeGr: number | null;
  cartridgeName: string;
  bulletLabel: string;
  powderLabel: string;
  rifleName: string;
  sourceTitle: string;
  safetyAcknowledged: boolean;
  sessionCount: number;
  latestAvgVelocityFps: number | null;
  bestGroupSizeIn: number | null;
  bestGroupDistanceYd: number | null;
  avgSdFps: number | null;
  avgEsFps: number | null;
};

export function buildCompareRows(loads: CompareLoadInput[]): CompareRow[] {
  return loads.map((l) => {
    let latest: { date: Date; avg: number | null } | null = null;
    let best: { size: number; dist: number | null } | null = null;
    let sdSum = 0;
    let sdCount = 0;
    let esSum = 0;
    let esCount = 0;

    for (const s of l.sessions) {
      if (!latest || s.date > latest.date) {
        latest = { date: s.date, avg: s.avgVelocityFps };
      }
      if (s.groupSizeIn != null) {
        if (best == null || s.groupSizeIn < best.size) {
          best = { size: s.groupSizeIn, dist: s.groupDistanceYd ?? null };
        }
      }
      if (s.sdFps != null) {
        sdSum += s.sdFps;
        sdCount += 1;
      }
      if (s.esFps != null) {
        esSum += s.esFps;
        esCount += 1;
      }
    }

    return {
      loadId: l.id,
      loadName: l.name,
      status: l.status,
      chargeGr: l.chargeGr,
      cartridgeName: l.cartridge?.name ?? '—',
      bulletLabel: l.bullet
        ? `${l.bullet.manufacturer} ${l.bullet.model}`
        : '—',
      powderLabel: l.powder
        ? `${l.powder.manufacturer} ${l.powder.model}`
        : '—',
      rifleName: l.rifle?.name ?? '—',
      sourceTitle: l.source?.title ?? '—',
      safetyAcknowledged: l.safetyAcknowledged,
      sessionCount: l.sessions.length,
      latestAvgVelocityFps: latest?.avg ?? null,
      bestGroupSizeIn: best?.size ?? null,
      bestGroupDistanceYd: best?.dist ?? null,
      avgSdFps:
        sdCount > 0 ? Math.round((sdSum / sdCount) * 10) / 10 : null,
      avgEsFps:
        esCount > 0 ? Math.round((esSum / esCount) * 10) / 10 : null,
    };
  });
}
