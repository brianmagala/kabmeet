// Dates on the event pages are always shown in Kabale time (East Africa Time), so an IndabaX day
// reads the same for everyone. The calendar file still uses UTC and lands correctly in any calendar.
const TZ = 'Africa/Kampala';

export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function formatDayLong(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}

export function formatDayShort(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** "Sat 5 Dec 2026, 09:30 to 17:00 EAT" or across days. */
export function formatRange(startIso: string, endIso: string): string {
  const sameDay = dayKey(startIso) === dayKey(endIso);
  return sameDay
    ? `${formatDayShort(startIso)}, ${formatTime(startIso)} to ${formatTime(endIso)} EAT`
    : `${formatDayShort(startIso)} ${formatTime(startIso)} to ${formatDayShort(endIso)} ${formatTime(endIso)} EAT`;
}

/** Sessions grouped by Kabale day, in time order. */
export function groupByDay<T extends { scheduledAt: string }>(items: T[]): Array<{ key: string; label: string; items: T[] }> {
  const sorted = [...items].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const item of sorted) {
    const key = dayKey(item.scheduledAt);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: formatDayLong(item.scheduledAt), items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

/** Value for <input type="datetime-local"> from an ISO time, in the browser's own zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
