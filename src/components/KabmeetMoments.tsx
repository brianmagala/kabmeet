import React from 'react';
import type { LoadingStage } from '../hooks/useLoadingStage';

/*
 * Moment loaders. Each one belongs to a single moment on the site, so people learn what it means
 * without reading. They use only Kabmeet tokens and plain CSS (see "Kabmeet moment loaders" in index.css),
 * so they stay light on weak campus networks and switch off under prefers-reduced-motion.
 *
 *   CardShimmer / ShimmerGrid  lists that are loading (Discover, Communities)
 *   PillPulseButton            a button that is waiting for the server (sign in, save, create)
 *   ThreadLoader               entering a room or a stream: a dot travels from YOU to the ROOM
 *   SignalBars                 connection quality with a word, in room and watch headers
 *   LensLoader                 the camera or screen share is starting
 *   HopDots                    chat is connecting
 *   SlowStageNotice            what to say as a wait gets longer (3 s, 8 s, 20 s)
 */

/** One placeholder with the exact shape of a session card. */
export function CardShimmer() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-surface"
      aria-hidden="true"
    >
      <div className="kab-shimmer aspect-video w-full" />
      <div className="space-y-3 p-4">
        <div className="kab-shimmer h-3.5 w-4/5 rounded-md" />
        <div className="kab-shimmer h-3 w-1/2 rounded-md" />
        <div className="flex items-center gap-2 pt-1">
          <div className="kab-shimmer h-6 w-6 rounded-full" />
          <div className="kab-shimmer h-3 w-24 rounded-md" />
          <div className="kab-shimmer ml-auto h-8 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ShimmerGrid({
  count = 6,
  className = 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3',
  label = 'Loading',
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className={className}>
      {Array.from({ length: count }, (_, i) => (
        <CardShimmer key={i} />
      ))}
    </div>
  );
}

/** A button that blocks double clicks and shows that the server is working. */
export function PillPulseButton({
  busy,
  busyLabel,
  className = '',
  disabled,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy: boolean; busyLabel: string }) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy}
      className={`relative overflow-hidden ${className} ${busy ? 'kab-pill-busy' : ''}`}
    >
      {busy && <span className="kab-ping-dot" aria-hidden="true" />}
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}

/** A dot travels from "you" to the room; the room lights up when it arrives. */
export function ThreadLoader({
  fromLabel = 'YOU',
  toLabel = 'ROOM',
  className = '',
}: {
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 64"
      role="img"
      aria-label={`Connecting ${fromLabel.toLowerCase()} to ${toLabel.toLowerCase()}`}
      className={`h-16 w-full max-w-[280px] ${className}`}
    >
      <line
        x1="34"
        y1="26"
        x2="206"
        y2="26"
        stroke="var(--indaba-deep-green)"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />
      <circle cx="20" cy="26" r="8" fill="var(--signal-green)" />
      <circle cx="220" cy="26" r="8" fill="none" stroke="var(--signal-green)" strokeWidth="2.5" />
      <circle cx="220" cy="26" r="8" fill="var(--signal-green)" className="kab-thread-arrive" />
      <circle cx="30" cy="26" r="4.5" fill="var(--sun-yellow)" className="kab-thread-dot" />
      <text x="20" y="54" textAnchor="middle" fontSize="10" letterSpacing="1.2" fill="currentColor" opacity="0.65">
        {fromLabel}
      </text>
      <text x="220" y="54" textAnchor="middle" fontSize="10" letterSpacing="1.2" fill="currentColor" opacity="0.65">
        {toLabel}
      </text>
    </svg>
  );
}

export type SignalLevel = 'strong' | 'weak' | 'reconnecting';

/** Connection quality as bars plus a word, so color is never the only clue. */
export function SignalBars({
  level,
  label,
  className = '',
}: {
  level: SignalLevel;
  label: string;
  className?: string;
}) {
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`kab-bars kab-bars-${level}`} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </span>
  );
}

/** Shown while the browser is asking for the camera or screen, which can take a few seconds. */
export function LensLoader({ label = 'Starting your camera' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 text-white">
      <span className="kab-lens" aria-hidden="true">
        <span className="kab-lens-sweep" />
        <span className="kab-lens-iris" />
        <span className="kab-lens-glint" />
      </span>
      <span className="text-xs text-mist/85">{label}</span>
    </div>
  );
}

/** Three dots hopping in a small bubble: quiet enough to sit next to chat. */
export function HopDots({ label = 'Connecting to chat' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[11px] text-muted">
      <span className="kab-hop" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </span>
  );
}

/** What to say as a wait gets longer. Stage numbers come from useLoadingStage. */
export function SlowStageNotice({
  stage,
  extraHint,
  onRetry,
}: {
  stage: LoadingStage;
  extraHint?: string | null;
  onRetry?: () => void;
}) {
  if (stage >= 4) {
    return (
      <div role="status" className="mt-4 flex flex-col items-center gap-2 text-center">
        <p className="max-w-sm text-xs text-foreground">
          We could not reach Kabmeet. Check your connection and try again.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-9 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest transition-transform active:scale-95"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const text = stage >= 2 ? 'Your connection is slow. Still trying.' : extraHint;
  if (!text) return null;

  return (
    <div role="status" className="mt-4 flex flex-col items-center gap-2">
      {/* The Data saver offer lives in the AppShell banner, so it is not repeated here. */}
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-gold/50 bg-sun-yellow/20 px-3.5 py-1.5 text-[11px] font-medium text-foreground">
        <span className="h-2 w-2 rounded-full bg-amber-gold" aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  );
}
