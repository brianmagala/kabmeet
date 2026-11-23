export interface PresenceTracker {
  viewerCount: number;
  peakViewers: number;
}

export class RoomPresenceStore {
  private readonly rooms = new Map<string, Set<string>>();
  private readonly peaks = new Map<string, number>();

  join(sessionId: string, clientId: string): PresenceTracker {
    let set = this.rooms.get(sessionId);
    if (!set) {
      set = new Set();
      this.rooms.set(sessionId, set);
    }
    set.add(clientId);
    const peak = Math.max(this.peaks.get(sessionId) ?? 0, set.size);
    this.peaks.set(sessionId, peak);
    return { viewerCount: set.size, peakViewers: peak };
  }

  leave(sessionId: string, clientId: string): PresenceTracker {
    const set = this.rooms.get(sessionId);
    if (set) {
      set.delete(clientId);
    }
    return {
      viewerCount: set ? set.size : 0,
      peakViewers: this.peaks.get(sessionId) ?? 0,
    };
  }
}
