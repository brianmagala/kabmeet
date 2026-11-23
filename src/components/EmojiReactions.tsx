import React, { useCallback, useRef, useState } from 'react';
import { SmilePlus, X } from 'lucide-react';
import type { FloatingHeart } from '../hooks/useSessionRealtime';

export interface ReactionEmojiOption {
  emoji: string;
  label: string;
}

export const REACTION_EMOJIS: readonly ReactionEmojiOption[] = [
  { emoji: '❤️', label: 'Like' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🙌', label: 'Celebrate' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '🚀', label: 'Launch' },
  { emoji: '💯', label: '100' },
] as const;

export interface TapHeartBurst {
  id: string;
  xPercent: number;
  yPercent: number;
  emoji: string;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('button, a, input, textarea, select, [role="button"], [data-no-doubletap="true"]'),
  );
}

export function useDoubleTapLike(onLike: (xPercent: number, yPercent: number) => void) {
  const [tapBursts, setTapBursts] = useState<TapHeartBurst[]>([]);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const spawnBurst = useCallback(
    (clientX: number, clientY: number, container: HTMLElement) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const xPercent = Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100));
      const yPercent = Math.max(12, Math.min(88, ((clientY - rect.top) / rect.height) * 100));
      const id = `tap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      setTapBursts((prev) => [...prev.slice(-10), { id, xPercent, yPercent, emoji: '❤️' }]);
      window.setTimeout(() => {
        setTapBursts((prev) => prev.filter((b) => b.id !== id));
      }, 980);

      onLike(xPercent, yPercent);
    },
    [onLike],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isInteractiveTarget(e.target)) return;
      spawnBurst(e.clientX, e.clientY, e.currentTarget);
    },
    [spawnBurst],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (isInteractiveTarget(e.target)) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const now = Date.now();
      const prev = lastTapRef.current;

      if (
        prev &&
        now - prev.time < 320 &&
        Math.hypot(touch.clientX - prev.x, touch.clientY - prev.y) < 48
      ) {
        lastTapRef.current = null;
        spawnBurst(touch.clientX, touch.clientY, e.currentTarget);
      } else {
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      }
    },
    [spawnBurst],
  );

  return {
    tapBursts,
    doubleTapHandlers: {
      onDoubleClick,
      onTouchEnd,
    },
  };
}

export function FloatingReactionsOverlay({
  hearts,
  tapBursts,
}: {
  hearts: FloatingHeart[];
  tapBursts: TapHeartBurst[];
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Floating multi-emoji stream reactions animated with emoji-sway-float */}
      {hearts.map((h) => (
        <div
          key={h.id}
          style={{ left: `${h.leftPercent}%` }}
          className="animate-emoji-float absolute bottom-16 flex -translate-x-1/2 flex-col items-center gap-0.5"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-night-forest/85 text-xl shadow-lg backdrop-blur-sm">
            {h.emoji}
          </span>
          {h.userName && (
            <span className="max-w-[96px] truncate rounded-full bg-night-forest/85 px-2 py-0.5 text-[10px] font-medium text-mist/90">
              {h.userName}
            </span>
          )}
        </div>
      ))}

      {/* Double-tap ❤️ Like pop bursts directly at tap coordinates */}
      {tapBursts.map((b) => (
        <div
          key={b.id}
          style={{ left: `${b.xPercent}%`, top: `${b.yPercent}%` }}
          className="animate-doubletap-heart absolute flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-live-red/75 bg-night-forest/70 text-4xl shadow-2xl backdrop-blur-xs">
            {b.emoji}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReactionBar({
  onReact,
  compact = false,
  collapsible = false,
}: {
  onReact: (emoji: string) => void;
  compact?: boolean;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [recentEmoji, setRecentEmoji] = useState<string | null>(null);

  const handleSelect = (emoji: string) => {
    setRecentEmoji(emoji);
    onReact(emoji);
    window.setTimeout(() => {
      setRecentEmoji((curr) => (curr === emoji ? null : curr));
    }, 260);
  };

  return (
    <div
      data-no-doubletap="true"
      role="group"
      aria-label="Floating emoji reactions"
      className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-amber-gold/45 bg-night-forest/90 shadow-xl backdrop-blur-md ${
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
      }`}
    >
      {expanded &&
        REACTION_EMOJIS.map((item) => {
          const active = recentEmoji === item.emoji;
          return (
            <button
              key={item.emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(item.emoji);
              }}
              title={item.label}
              aria-label={`React with ${item.label} ${item.emoji}`}
              className={`inline-flex shrink-0 items-center justify-center rounded-full transition-transform duration-150 hover:scale-125 hover:bg-white/15 active:scale-90 ${
                active ? 'scale-125 bg-signal-green/25 ring-1 ring-signal-green' : ''
              } ${compact ? 'h-8 w-8 text-base' : 'h-8 w-8 text-lg sm:h-9 sm:w-9'}`}
            >
              <span aria-hidden="true">{item.emoji}</span>
            </button>
          );
        })}

      {collapsible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((prev) => !prev);
          }}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse reaction bar' : 'Expand reaction bar'}
          title={expanded ? 'Hide reactions' : 'Show reactions'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist/80 transition-colors hover:bg-white/15 hover:text-sun-yellow"
        >
          {expanded ? <X className="h-3.5 w-3.5" /> : <SmilePlus className="h-4 w-4 text-signal-green" />}
        </button>
      )}
    </div>
  );
}
