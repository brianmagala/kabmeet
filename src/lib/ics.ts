// Builds an .ics calendar file in the browser. Times are written in UTC ("Z"), so every calendar
// app shows them in the person's own time zone. A reminder fires 15 minutes before the start.

function utcStamp(iso: string): string {
  const d = new Date(iso);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** Escapes text values as RFC 5545 requires. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 bytes are folded onto continuation lines that start with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (byteLength(rest) > 75) {
    let cut = 75;
    // Never cut in the middle of a multi-byte character.
    while (byteLength(rest.slice(0, cut)) > 75) cut -= 1;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export interface IcsEvent {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  url?: string;
}

export function buildIcs(ev: IcsEvent, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kabale AI Club//Kabmeet//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.id}@kabmeet`,
    `DTSTAMP:${utcStamp(now.toISOString())}`,
    `DTSTART:${utcStamp(ev.startsAt)}`,
    `DTEND:${utcStamp(ev.endsAt)}`,
    `SUMMARY:${escapeText(ev.title)}`,
    `DESCRIPTION:${escapeText(ev.description + (ev.url ? `\n\n${ev.url}` : ''))}`,
    `LOCATION:${escapeText(ev.venue)}`,
    ...(ev.url ? [`URL:${ev.url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`${ev.title} starts in 15 minutes`)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Starts a download of the .ics file. */
export function downloadIcs(ev: IcsEvent): void {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
