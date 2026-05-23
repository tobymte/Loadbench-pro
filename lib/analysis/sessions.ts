// Per-load session summary. Pure aggregation over observed data — no predictions.

export type SessionSummaryInput = {
  date: Date;
  loadId: string | null;
  load: { id: string; name: string } | null;
  rifle: { id: string; name: string } | null;
  avgVelocityFps: number | null;
  sdFps: number | null;
  groupSizeIn: number | null;
};

export type LoadSummaryRow = {
  loadId: string;
  loadName: string;
  rifleName: string | null;
  count: number;
  latestAvgVelocityFps: number | null;
  bestGroupSizeIn: number | null;
  avgSdFps: number | null;
};

export function summarizeSessionsByLoad(
  sessions: SessionSummaryInput[],
): LoadSummaryRow[] {
  const buckets = new Map<
    string,
    {
      loadName: string;
      rifleNames: Map<string, number>;
      count: number;
      latest: { date: Date; avg: number | null } | null;
      bestGroup: number | null;
      sdSum: number;
      sdCount: number;
    }
  >();

  for (const s of sessions) {
    if (!s.load) continue;
    const key = s.load.id;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        loadName: s.load.name,
        rifleNames: new Map(),
        count: 0,
        latest: null,
        bestGroup: null,
        sdSum: 0,
        sdCount: 0,
      };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (s.rifle?.name) {
      bucket.rifleNames.set(
        s.rifle.name,
        (bucket.rifleNames.get(s.rifle.name) ?? 0) + 1,
      );
    }

    if (!bucket.latest || s.date > bucket.latest.date) {
      bucket.latest = { date: s.date, avg: s.avgVelocityFps };
    }

    if (s.groupSizeIn != null) {
      if (bucket.bestGroup == null || s.groupSizeIn < bucket.bestGroup) {
        bucket.bestGroup = s.groupSizeIn;
      }
    }

    if (s.sdFps != null) {
      bucket.sdSum += s.sdFps;
      bucket.sdCount += 1;
    }
  }

  const rows: LoadSummaryRow[] = [];
  for (const [loadId, b] of buckets.entries()) {
    let topRifle: string | null = null;
    let topCount = 0;
    for (const [name, count] of b.rifleNames.entries()) {
      if (count > topCount) {
        topCount = count;
        topRifle = name;
      }
    }
    rows.push({
      loadId,
      loadName: b.loadName,
      rifleName: topRifle,
      count: b.count,
      latestAvgVelocityFps: b.latest?.avg ?? null,
      bestGroupSizeIn: b.bestGroup,
      avgSdFps:
        b.sdCount > 0 ? Math.round((b.sdSum / b.sdCount) * 10) / 10 : null,
    });
  }

  rows.sort((a, b) => b.count - a.count || a.loadName.localeCompare(b.loadName));
  return rows;
}
