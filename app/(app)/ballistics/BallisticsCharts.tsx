'use client';

import { useMemo } from 'react';

export type ChartTrajectoryPoint = {
  rangeYd: number;
  velocityFps: number;
  energyFtLb: number;
  dropIn: number;
  driftIn: number;
  timeSec: number;
};

type Series = {
  key: string;
  label: string;
  unit: string;
  color: string;
  values: number[];
  invert?: boolean;
};

const COLORS = {
  drop: '#7aa2f7',
  velocity: '#9ece6a',
  energy: '#e0af68',
  drift: '#f7768e',
  time: '#bb9af7',
};

export function BallisticsCharts({
  points,
  showWind,
}: {
  points: ChartTrajectoryPoint[];
  showWind: boolean;
}) {
  const ranges = useMemo(() => points.map((p) => p.rangeYd), [points]);

  if (points.length < 2) return null;

  const series: Series[] = [
    {
      key: 'drop',
      label: 'Drop',
      unit: 'in',
      color: COLORS.drop,
      values: points.map((p) => p.dropIn),
      invert: true,
    },
    {
      key: 'velocity',
      label: 'Velocity',
      unit: 'fps',
      color: COLORS.velocity,
      values: points.map((p) => p.velocityFps),
    },
    {
      key: 'energy',
      label: 'Energy',
      unit: 'ft·lb',
      color: COLORS.energy,
      values: points.map((p) => p.energyFtLb),
    },
    {
      key: 'time',
      label: 'Time of flight',
      unit: 's',
      color: COLORS.time,
      values: points.map((p) => p.timeSec),
    },
  ];
  if (showWind) {
    series.push({
      key: 'drift',
      label: 'Wind drift',
      unit: 'in',
      color: COLORS.drift,
      values: points.map((p) => p.driftIn),
    });
  }

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      data-testid="ballistics-charts"
    >
      {series.map((s) => (
        <LineChart key={s.key} ranges={ranges} series={s} />
      ))}
    </div>
  );
}

function LineChart({ ranges, series }: { ranges: number[]; series: Series }) {
  const width = 480;
  const height = 200;
  const padLeft = 48;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 32;

  const xs = ranges;
  const ys = series.values;
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const yRangeRaw = yMax - yMin;
  const yPad = yRangeRaw === 0 ? Math.max(1, Math.abs(yMax) * 0.1) : yRangeRaw * 0.1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  function x(v: number) {
    if (xMax === xMin) return padLeft;
    return padLeft + ((v - xMin) / (xMax - xMin)) * (width - padLeft - padRight);
  }
  function y(v: number) {
    if (yHi === yLo) return height - padBottom;
    return (
      height -
      padBottom -
      ((v - yLo) / (yHi - yLo)) * (height - padTop - padBottom)
    );
  }

  const points: string = xs
    .map((vx, i) => `${x(vx).toFixed(1)},${y(ys[i]).toFixed(1)}`)
    .join(' ');

  const yTicks = [yLo, yLo + (yHi - yLo) / 2, yHi];
  const xTicks = [
    xs[0],
    xs[Math.floor(xs.length / 2)],
    xs[xs.length - 1],
  ];

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1000) return Math.round(n).toString();
    if (Math.abs(n) >= 10) return n.toFixed(1);
    return n.toFixed(2);
  };

  const subtitle = series.invert
    ? 'Lower is more drop (negative = bullet below line of sight).'
    : '';

  return (
    <div
      className="rounded-md border border-border bg-bg-alt/30 p-3"
      data-testid={`ballistics-chart-${series.key}`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-faint">
            {series.label} ({series.unit})
          </div>
          {subtitle && (
            <div className="text-[10px] text-text-faint mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className="text-[11px] text-text-muted tabular-nums">
          {fmt(ys[0])} → {fmt(ys[ys.length - 1])} {series.unit}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${series.label} versus range`}
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y(t)}
              y2={y(t)}
              stroke="#1b212b"
              strokeDasharray="2 4"
            />
            <text
              x={padLeft - 6}
              y={y(t)}
              fontSize="10"
              fill="#7e8794"
              textAnchor="end"
              alignmentBaseline="middle"
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={i}>
            <text
              x={x(t)}
              y={height - padBottom + 14}
              fontSize="10"
              fill="#7e8794"
              textAnchor="middle"
            >
              {t} yd
            </text>
          </g>
        ))}
        <polyline
          points={points}
          fill="none"
          stroke={series.color}
          strokeWidth={1.8}
          vectorEffect="non-scaling-stroke"
        />
        {xs.map((vx, i) => (
          <circle
            key={i}
            cx={x(vx)}
            cy={y(ys[i])}
            r={1.5}
            fill={series.color}
          />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-text-faint leading-snug">
        External flight only. No pressure, no charge advice.
      </p>
    </div>
  );
}
