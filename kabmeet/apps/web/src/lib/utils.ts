// Phase 0 Step A placeholder — shared web utility helpers
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
