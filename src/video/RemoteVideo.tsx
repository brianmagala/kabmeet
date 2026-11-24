import { useEffect, useRef } from 'react';
import type { RemoteTrack } from 'livekit-client';

/** Draws one remote camera or screen track. Audio is handled separately by the hook. */
export function RemoteVideo({ track, label, contain }: { track: RemoteTrack; label: string; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      aria-label={label}
      className={`h-full w-full bg-night-forest ${contain ? 'object-contain' : 'object-cover'}`}
    />
  );
}
