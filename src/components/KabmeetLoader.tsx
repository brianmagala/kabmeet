import React, { useId } from 'react';

export type LoaderSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<LoaderSize, number> = {
  xs: 18,
  sm: 28,
  md: 56,
  lg: 88,
};

/**
 * Kabmeet Signal Prism:
 * Custom kinetic broadcast + neural lattice SVG loader built strictly from
 * Kabmeet's IndabaX & KAB AI palette (Deep Green, Signal Green, KAB Blue, Sun Yellow, Amber Gold).
 */
export function KabmeetSignalPrism({
  size = 'md',
  label = 'Loading',
  className = '',
}: {
  size?: LoaderSize;
  label?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const px = SIZE_PX[size];

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 100 100"
        width={px}
        height={px}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`kab-arc-${uid}`} x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--signal-green)" />
            <stop offset="55%" stopColor="var(--kab-blue)" />
            <stop offset="100%" stopColor="var(--indaba-deep-green)" />
          </linearGradient>

          <linearGradient id={`kab-sun-${uid}`} x1="20" y1="80" x2="80" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--sun-yellow)" />
            <stop offset="100%" stopColor="var(--amber-gold)" />
          </linearGradient>

          <linearGradient id={`kab-core-${uid}`} x1="36" y1="36" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--signal-green)" />
            <stop offset="100%" stopColor="var(--sun-yellow)" />
          </linearGradient>
        </defs>

        {/* Subtle geometric telemetry guide ring */}
        <circle
          cx="50"
          cy="50"
          r="42"
          stroke="var(--indaba-deep-green)"
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />

        {/* Dual expanding broadcast sonar waves (only in md/lg for crisp detail) */}
        {(size === 'md' || size === 'lg') && (
          <>
            <circle
              cx="50"
              cy="50"
              r="24"
              stroke="var(--signal-green)"
              strokeOpacity="0.5"
              strokeWidth="1.75"
              className="kab-sonar-ring"
            />
            <circle
              cx="50"
              cy="50"
              r="24"
              stroke="var(--kab-blue)"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              className="kab-sonar-ring-delay"
            />
          </>
        )}

        {/* Outer Kinetic Signal Orbit (Signal Green -> KAB Blue) */}
        <g className="kab-spin-cw">
          <circle
            cx="50"
            cy="50"
            r="39"
            stroke={`url(#kab-arc-${uid})`}
            strokeWidth={size === 'xs' ? 7 : 5}
            strokeLinecap="round"
            strokeDasharray="96 42 36 90"
            className="kab-dash-flow"
          />
          {/* Leading orbital satellite node */}
          <circle cx="50" cy="11" r={size === 'xs' ? 5.5 : 4.2} fill="var(--signal-green)" />
        </g>

        {/* Inner Counter-Rotating Precision Chevron Arc (Sun Yellow -> Amber Gold) */}
        <g className="kab-spin-ccw">
          <circle
            cx="50"
            cy="50"
            r="28"
            stroke={`url(#kab-sun-${uid})`}
            strokeWidth={size === 'xs' ? 6 : 4}
            strokeLinecap="round"
            strokeDasharray="48 44 26 58"
          />
          <circle cx="50" cy="78" r={size === 'xs' ? 4.5 : 3.4} fill="var(--sun-yellow)" />
        </g>

        {/* Tilted Gyroscope Orbit Satellite (KAB Blue node) */}
        {(size === 'md' || size === 'lg') && (
          <g transform="rotate(-24 50 50)">
            <ellipse
              cx="50"
              cy="50"
              rx="45"
              ry="16"
              stroke="var(--kab-blue)"
              strokeOpacity="0.28"
              strokeWidth="1.25"
            />
            <g className="kab-spin-cw" style={{ animationDuration: '3.2s' }}>
              <circle cx="95" cy="50" r="3.4" fill="var(--kab-blue)" />
            </g>
          </g>
        )}

        {/* Center Faceted Signal Prism + Live Core Beacon */}
        <g className="kab-prism-core">
          <polygon
            points="50,35 63,50 50,65 37,50"
            fill="var(--indaba-deep-green)"
            stroke={`url(#kab-core-${uid})`}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="50" r={size === 'xs' ? 5 : 4.2} fill="var(--signal-green)" />
        </g>
      </svg>
    </span>
  );
}

/**
 * Full section / page loading stage with optional slow-network status callout.
 */
export function KabmeetLoadingCard({
  label = 'Loading Kabmeet...',
  sublabel = 'Fetching live sessions and community updates.',
  slowHint,
  compact = false,
}: {
  label?: string;
  sublabel?: string;
  slowHint?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-border bg-surface text-center shadow-sm ${
        compact ? 'px-5 py-10' : 'px-6 py-16'
      }`}
    >
      <div className="relative flex items-center justify-center rounded-full bg-indaba-deep-green/10 p-4 dark:bg-night-forest/80">
        <KabmeetSignalPrism size={compact ? 'md' : 'lg'} label={label} />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold uppercase tracking-wide text-foreground">
        {label}
      </h2>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">{sublabel}</p>
      {slowHint && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-gold/50 bg-sun-yellow/20 px-3.5 py-1.5 text-[11px] font-medium text-foreground">
          <span className="h-2 w-2 rounded-full bg-amber-gold" aria-hidden="true" />
          <span>{slowHint}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Precision 3px top-edge progress ribbon below the sticky IndabaX header.
 */
export function TopNetworkBar({
  active,
  slow,
}: {
  active: boolean;
  slow: boolean;
}) {
  if (!active && !slow) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 right-0 top-16 z-40 h-[3px] overflow-hidden bg-indaba-deep-green/40"
    >
      <div
        className={`kab-progress-bar h-full w-2/5 rounded-full ${
          slow
            ? 'bg-gradient-to-r from-amber-gold via-sun-yellow to-signal-green'
            : 'bg-gradient-to-r from-signal-green via-sun-yellow to-kab-blue'
        }`}
      />
    </div>
  );
}
