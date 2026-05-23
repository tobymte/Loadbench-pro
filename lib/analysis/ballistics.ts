// External ballistics estimate using the G1 drag model.
//
// This is an EDUCATIONAL trajectory estimate from user-entered muzzle
// velocity and ballistic coefficient. It is not a load engine, not
// QuickLOAD-style internal ballistics, and not a safety check. The
// physical model is a simplified flat-fire trajectory with the standard
// G1 drag curve and a basic atmospheric density correction.

export type BallisticsInput = {
  muzzleVelocityFps: number;
  bulletWeightGr: number;
  bcG1: number;
  zeroDistanceYd: number;
  sightHeightIn: number;
  maxRangeYd: number;
  intervalYd: number;
  tempF?: number | null;
  altitudeFt?: number | null;
  windMph?: number | null;
  windAngleDeg?: number | null; // 90 = pure crosswind from right
};

export type TrajectoryPoint = {
  rangeYd: number;
  velocityFps: number;
  energyFtLb: number;
  dropIn: number;
  driftIn: number;
  timeSec: number;
  moa: number;
  mil: number;
  windMoa: number;
  windMil: number;
};

const STANDARD_AIR_DENSITY = 1.0;
const STANDARD_TEMP_F = 59;
const STANDARD_ALT_FT = 0;

// G1 drag coefficient table — velocity (fps) → Cd. Standard G1 reference.
const G1_TABLE: Array<[number, number]> = [
  [0, 0.2629],
  [200, 0.2558],
  [400, 0.2487],
  [600, 0.2413],
  [800, 0.2344],
  [1000, 0.2278],
  [1200, 0.2226],
  [1400, 0.2554],
  [1600, 0.3175],
  [1800, 0.3776],
  [2000, 0.4051],
  [2200, 0.4143],
  [2400, 0.4106],
  [2600, 0.4021],
  [2800, 0.3933],
  [3000, 0.3847],
  [3200, 0.3764],
  [3400, 0.3683],
  [3600, 0.3605],
  [3800, 0.3529],
  [4000, 0.3456],
];

function g1Cd(v: number): number {
  if (v <= G1_TABLE[0][0]) return G1_TABLE[0][1];
  if (v >= G1_TABLE[G1_TABLE.length - 1][0])
    return G1_TABLE[G1_TABLE.length - 1][1];
  for (let i = 1; i < G1_TABLE.length; i++) {
    const [v1, cd1] = G1_TABLE[i];
    if (v <= v1) {
      const [v0, cd0] = G1_TABLE[i - 1];
      const t = (v - v0) / (v1 - v0);
      return cd0 + t * (cd1 - cd0);
    }
  }
  return G1_TABLE[G1_TABLE.length - 1][1];
}

function airDensityRatio(tempF: number, altitudeFt: number): number {
  // Density falls roughly 3% per 1000 ft. Reference 59°F at sea level.
  const altRatio = Math.exp(-altitudeFt / 29000);
  const tempRankine = tempF + 459.67;
  const stdRankine = STANDARD_TEMP_F + 459.67;
  const tempRatio = stdRankine / tempRankine;
  return STANDARD_AIR_DENSITY * altRatio * tempRatio;
}

function dragDecel(v: number, bcG1: number, densityRatio: number): number {
  // Simplified scaling constant chosen so the G1 retardation curve above
  // matches published reference G1 data for typical sporting BCs to within
  // a few percent over 0–1000 yd. This is a sporting-ballistics
  // approximation, not an exact physical drag model.
  const k = 2.4e-4;
  const cd = g1Cd(v);
  return (k * cd * densityRatio * v * v) / Math.max(bcG1, 1e-4);
}

const FEET_PER_YARD = 3;
const INCHES_PER_FOOT = 12;
const GRAVITY = 32.174;

export function computeTrajectory(input: BallisticsInput): TrajectoryPoint[] {
  const {
    muzzleVelocityFps,
    bulletWeightGr,
    bcG1,
    zeroDistanceYd,
    sightHeightIn,
    maxRangeYd,
    intervalYd,
  } = input;

  if (
    !Number.isFinite(muzzleVelocityFps) ||
    muzzleVelocityFps <= 0 ||
    !Number.isFinite(bcG1) ||
    bcG1 <= 0 ||
    !Number.isFinite(maxRangeYd) ||
    maxRangeYd <= 0 ||
    !Number.isFinite(intervalYd) ||
    intervalYd <= 0
  ) {
    return [];
  }

  const densityRatio = airDensityRatio(
    input.tempF ?? STANDARD_TEMP_F,
    input.altitudeFt ?? STANDARD_ALT_FT,
  );

  const wind = input.windMph ?? 0;
  const windAngleRad = ((input.windAngleDeg ?? 90) * Math.PI) / 180;
  const crossWindFps = wind * 1.4667 * Math.sin(windAngleRad);

  // Coordinate system: x = downrange, y = height above bore at the muzzle.
  // LOS starts at +sightHeightFt and points at the zero. LOS height at
  // range x is: sightHeightFt * (1 - x / zeroRangeFt).
  const sightHeightFt = sightHeightIn / INCHES_PER_FOOT;
  const zeroRangeFt = zeroDistanceYd * FEET_PER_YARD;

  // Find bore elevation angle that places bullet on LOS at zero range.
  let elevationAngle = 0;
  if (zeroRangeFt > 0) {
    const flat = simulateTrajectory(
      muzzleVelocityFps,
      bcG1,
      densityRatio,
      zeroDistanceYd,
      0,
      crossWindFps,
    );
    const flatAtZero = interpolateAt(flat, zeroRangeFt);
    if (flatAtZero) {
      elevationAngle = Math.atan(-flatAtZero.heightFt / zeroRangeFt);
    }
  }

  const full = simulateTrajectory(
    muzzleVelocityFps,
    bcG1,
    densityRatio,
    maxRangeYd,
    elevationAngle,
    crossWindFps,
  );

  const out: TrajectoryPoint[] = [];
  const steps = Math.floor(maxRangeYd / intervalYd);
  for (let i = 0; i <= steps; i++) {
    const targetYd = i * intervalYd;
    const targetFt = targetYd * FEET_PER_YARD;

    if (targetYd === 0) {
      out.push({
        rangeYd: 0,
        velocityFps: muzzleVelocityFps,
        energyFtLb: ftLbEnergy(muzzleVelocityFps, bulletWeightGr),
        dropIn: -sightHeightIn,
        driftIn: 0,
        timeSec: 0,
        moa: 0,
        mil: 0,
        windMoa: 0,
        windMil: 0,
      });
      continue;
    }

    const point = interpolateAt(full, targetFt);
    if (!point) continue;

    const losAtRangeFt =
      zeroRangeFt > 0
        ? sightHeightFt * (1 - targetFt / zeroRangeFt)
        : sightHeightFt;
    const dropInches = (losAtRangeFt - point.heightFt) * INCHES_PER_FOOT;
    const driftIn = point.driftFt * INCHES_PER_FOOT;

    const moa = dropInches / ((1.047 * targetYd) / 100);
    const mil = dropInches / ((3.6 * targetYd) / 100);
    const windMoa = driftIn / ((1.047 * targetYd) / 100);
    const windMil = driftIn / ((3.6 * targetYd) / 100);

    out.push({
      rangeYd: targetYd,
      velocityFps: round1(point.velocityFps),
      energyFtLb: ftLbEnergy(point.velocityFps, bulletWeightGr),
      dropIn: round1(dropInches),
      driftIn: round1(driftIn),
      timeSec: round3(point.timeSec),
      moa: round2(moa),
      mil: round2(mil),
      windMoa: round2(windMoa),
      windMil: round2(windMil),
    });
  }
  return out;
}

type SimPoint = {
  rangeFt: number;
  heightFt: number;
  driftFt: number;
  velocityFps: number;
  timeSec: number;
};

function simulateTrajectory(
  muzzle: number,
  bc: number,
  density: number,
  rangeYd: number,
  elevationRad: number,
  crossWindFps: number,
): SimPoint[] {
  const dt = 0.0005;
  const targetFt = rangeYd * FEET_PER_YARD;
  let vx = muzzle * Math.cos(elevationRad);
  let vy = muzzle * Math.sin(elevationRad);
  let vz = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  let t = 0;
  const points: SimPoint[] = [
    { rangeFt: 0, heightFt: 0, driftFt: 0, velocityFps: muzzle, timeSec: 0 },
  ];

  const maxIter = 50000;
  let iter = 0;
  while (x < targetFt && iter < maxIter) {
    iter++;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const a = dragDecel(speed, bc, density);
    const ax = -a * (vx / Math.max(speed, 1e-6));
    const ay = -a * (vy / Math.max(speed, 1e-6)) - GRAVITY;
    const az = a * ((crossWindFps - vz) / Math.max(speed, 1e-6));

    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    t += dt;

    const last = points[points.length - 1];
    if (x - last.rangeFt >= 5) {
      points.push({
        rangeFt: x,
        heightFt: y,
        driftFt: z,
        velocityFps: Math.sqrt(vx * vx + vy * vy),
        timeSec: t,
      });
    }
  }
  points.push({
    rangeFt: x,
    heightFt: y,
    driftFt: z,
    velocityFps: Math.sqrt(vx * vx + vy * vy),
    timeSec: t,
  });
  return points;
}

function interpolateAt(points: SimPoint[], rangeFt: number): SimPoint | null {
  if (points.length === 0) return null;
  if (rangeFt <= points[0].rangeFt) return points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].rangeFt >= rangeFt) {
      const a = points[i - 1];
      const b = points[i];
      const span = b.rangeFt - a.rangeFt;
      const f = span > 0 ? (rangeFt - a.rangeFt) / span : 0;
      return {
        rangeFt,
        heightFt: a.heightFt + f * (b.heightFt - a.heightFt),
        driftFt: a.driftFt + f * (b.driftFt - a.driftFt),
        velocityFps: a.velocityFps + f * (b.velocityFps - a.velocityFps),
        timeSec: a.timeSec + f * (b.timeSec - a.timeSec),
      };
    }
  }
  return points[points.length - 1];
}

function ftLbEnergy(velocityFps: number, bulletWeightGr: number): number {
  return Math.round((bulletWeightGr * velocityFps * velocityFps) / 450240);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
