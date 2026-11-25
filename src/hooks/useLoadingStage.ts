import { useEffect, useState } from 'react';

/**
 * How long a wait has lasted, in the steps Kabmeet reacts to.
 *   0  under 0.4 s   show nothing (fast loads should not flash a loader)
 *   1  0.4 s         show the loader
 *   2  3 s           say plainly that the connection is slow
 *   3  8 s           offer Data saver (less video, more chance to finish)
 *   4  20 s          stop waiting: offer Try again, keep what is already on the page
 * These steps follow the usual response-time limits (about 0.1 s, 1 s and 10 s).
 */
export const LOADING_STAGE_MS = [400, 3000, 8000, 20000] as const;
export type LoadingStage = 0 | 1 | 2 | 3 | 4;

export function useLoadingStage(isLoading: boolean): LoadingStage {
  const [stage, setStage] = useState<LoadingStage>(0);

  useEffect(() => {
    if (!isLoading) {
      setStage(0);
      return;
    }
    const timers = LOADING_STAGE_MS.map((ms, i) => window.setTimeout(() => setStage((i + 1) as LoadingStage), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [isLoading]);

  return isLoading ? stage : 0;
}
