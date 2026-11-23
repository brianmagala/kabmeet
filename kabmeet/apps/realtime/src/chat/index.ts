export interface ChatModerationState {
  chatLocked: boolean;
  slowModeSeconds: number;
  blockedWords: string[];
  pinnedMessageId: string | null;
}

export function sanitizeBlockedWords(text: string, blockedWords: string[]): string {
  let clean = text.trim().slice(0, 400);
  for (const word of blockedWords) {
    if (word.trim()) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clean = clean.replace(new RegExp(escaped, 'gi'), '***');
    }
  }
  return clean;
}

export function checkSlowMode(lastSentAt: number, slowModeSeconds: number, isStaff: boolean): boolean {
  if (isStaff || slowModeSeconds <= 0) return true;
  return Date.now() - lastSentAt >= slowModeSeconds * 1000;
}
