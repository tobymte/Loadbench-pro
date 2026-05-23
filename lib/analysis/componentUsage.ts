// Component inventory usage estimates.
//
// These are RECORDKEEPING estimates only. They are computed from the
// shotsFired and chargeGr values the user has entered against their own
// loads and range sessions. They are NOT a measurement of physical
// inventory, and LoadBench Pro does not use them to recommend charges,
// substitutions, or component life remaining.
//
//   Powder usage estimate (lb) = sum( load.chargeGr * session.shotsFired ) / 7000
//   Bullet usage estimate (ct) = sum( session.shotsFired ) where component is bullet
//   Primer usage estimate (ct) = sum( session.shotsFired ) where component is primer
//   Case   usage estimate (ct) = sum( session.shotsFired ) where component is case
//     — labeled as "rounds loaded/fired", not "case life remaining".

import type { ComponentKind } from '@prisma/client';

export type SessionLike = {
  shotsFired: number | null;
};

export type LoadWithSessions = {
  id: string;
  chargeGr: number | null;
  sessions: SessionLike[];
};

export type UsageEstimate = {
  // Total shots fired across linked sessions where shotsFired is recorded.
  shotsFired: number;
  // Powder consumed estimate in pounds (POWDER kind only); null otherwise.
  powderLb: number | null;
  // Powder consumed estimate in grains (POWDER kind only); null otherwise.
  powderGr: number | null;
  // Number of loads that reference this component.
  linkedLoads: number;
  // Number of sessions tied to those loads where shotsFired was recorded.
  linkedSessionsWithShots: number;
};

export function estimateUsage(
  kind: ComponentKind,
  loads: LoadWithSessions[],
): UsageEstimate {
  let shotsFired = 0;
  let powderGr = 0;
  let linkedSessionsWithShots = 0;

  for (const load of loads) {
    for (const s of load.sessions) {
      const shots = s.shotsFired ?? 0;
      if (shots <= 0) continue;
      linkedSessionsWithShots += 1;
      shotsFired += shots;
      if (kind === 'POWDER' && load.chargeGr != null && load.chargeGr > 0) {
        powderGr += load.chargeGr * shots;
      }
    }
  }

  return {
    shotsFired,
    powderGr: kind === 'POWDER' ? powderGr : null,
    powderLb: kind === 'POWDER' ? powderGr / 7000 : null,
    linkedLoads: loads.length,
    linkedSessionsWithShots,
  };
}

// Returns "estimated remaining" only when units make the comparison sensible:
//   - powder with unit "lb": remaining_lb = quantityOnHand - powderLb
//   - powder with unit "gr": remaining_gr = quantityOnHand - powderGr
//   - bullet/primer/case with unit "ct": remaining_ct = quantityOnHand - shotsFired
// Returns null in any other case (units missing, mismatched, or quantity null).
export function estimateRemaining(
  kind: ComponentKind,
  quantityOnHand: number | null,
  unit: string | null,
  usage: UsageEstimate,
): { value: number; unit: string } | null {
  if (quantityOnHand == null || !unit) return null;
  const u = unit.trim().toLowerCase();

  if (kind === 'POWDER') {
    if (u === 'lb' && usage.powderLb != null) {
      return { value: quantityOnHand - usage.powderLb, unit: 'lb' };
    }
    if (u === 'gr' && usage.powderGr != null) {
      return { value: quantityOnHand - usage.powderGr, unit: 'gr' };
    }
    return null;
  }

  if (u === 'ct' || u === 'count' || u === 'pcs') {
    return { value: quantityOnHand - usage.shotsFired, unit: 'ct' };
  }
  return null;
}

export function isLowStock(
  quantityOnHand: number | null,
  lowStockThreshold: number | null,
): boolean {
  if (quantityOnHand == null || lowStockThreshold == null) return false;
  return quantityOnHand <= lowStockThreshold;
}
