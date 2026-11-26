// Draws the certificate. Pure: it gets plain values and returns PDF bytes (no store, no network).
// Standard PDF fonts keep the file small and need no font files, so names with letters outside the
// Latin alphabet are shown as "?" rather than breaking the download.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { CertificateKind } from '../src/shared/events';

const GREEN = rgb(0x06 / 255, 0x5a / 255, 0x4b / 255); // Indaba Deep Green
const SIGNAL = rgb(0, 0xe6 / 255, 0x76 / 255); // Signal Green
const GOLD = rgb(0xf6 / 255, 0xa6 / 255, 0x23 / 255); // Amber Gold
const INK = rgb(0x0a / 255, 0x1f / 255, 0x1a / 255); // Night Forest
const MUTED = rgb(0.29, 0.36, 0.34);
const LINE = rgb(0xd5 / 255, 0xe3 / 255, 0xde / 255);

export interface CertificateInput {
  name: string;
  eventTitle: string;
  /** Already formatted, for example "5 December 2026". */
  eventDate: string;
  venue: string;
  kind: CertificateKind;
  teamName: string | null;
  code: string;
  /** Address people can open to check the certificate, for example "https://ai.kab.ac.ug/verify/KAB-2026-AB3K". */
  verifyUrl: string;
  issuedOn: string;
}

/** Replaces characters the standard font cannot draw. */
export function safeText(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text.replace(/[\r\n\t]+/g, ' ')) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest size (down to a floor) at which the text fits on one line. */
function fitSize(font: PDFFont, text: string, start: number, min: number, maxWidth: number): number {
  let size = start;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

const TITLES: Record<CertificateKind, { title: string; lead: string }> = {
  ATTENDANCE: { title: 'Certificate of Attendance', lead: 'attended' },
  WINNER: { title: 'Certificate of Achievement', lead: 'won the hackathon at' },
  RUNNER_UP: { title: 'Certificate of Achievement', lead: 'was runner-up in the hackathon at' },
};

export async function buildCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${TITLES[input.kind].title}: ${input.name}`);
  doc.setAuthor('Kabale AI Club');
  doc.setSubject(input.eventTitle);
  const page = doc.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  const center = (text: string, y: number, font: PDFFont, size: number, color = INK) => {
    const t = safeText(font, text);
    page.drawText(t, { x: (width - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };
  /** Capital letters with a little air between them, like a printed letterhead. */
  const spaced = (text: string, y: number, font: PDFFont, size: number, color = GREEN) => {
    const t = safeText(font, text.toUpperCase());
    const gap = 2.4;
    const total = [...t].reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size) + gap, -gap);
    let x = (width - total) / 2;
    for (const ch of t) {
      page.drawText(ch, { x, y, size, font, color });
      x += font.widthOfTextAtSize(ch, size) + gap;
    }
  };

  // Frame: one strong green line, one pale line inside it, and a short Signal Green bar on top.
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: GREEN, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: LINE, borderWidth: 1 });
  page.drawRectangle({ x: width / 2 - 40, y: height - 29, width: 80, height: 6, color: SIGNAL });
  if (input.kind !== 'ATTENDANCE') {
    page.drawRectangle({ x: width / 2 - 40, y: 21, width: 80, height: 6, color: GOLD });
  }

  const maxW = width - 160;
  spaced('Kabale AI Club  ·  IndabaX', height - 92, bold, 11);
  center(TITLES[input.kind].title.toUpperCase(), height - 148, bold, 34, GREEN);
  if (input.kind !== 'ATTENDANCE') {
    spaced(input.kind === 'WINNER' ? 'Winner' : 'Runner-up', height - 176, bold, 12, GOLD);
  }

  center('This certifies that', height - 218, regular, 13, MUTED);
  const name = safeText(bold, input.name.trim() || 'Participant');
  const nameSize = fitSize(bold, name, 42, 20, maxW);
  center(name, height - 268, bold, nameSize);
  page.drawLine({ start: { x: width / 2 - 170, y: height - 282 }, end: { x: width / 2 + 170, y: height - 282 }, thickness: 1, color: SIGNAL });

  let y = height - 318;
  const lead =
    input.kind === 'ATTENDANCE'
      ? 'attended the sessions of'
      : input.teamName
        ? `with team “${input.teamName}” ${TITLES[input.kind].lead}`
        : TITLES[input.kind].lead;
  center(lead, y, regular, 13, MUTED);
  y -= 34;
  const title = safeText(bold, input.eventTitle);
  for (const line of wrap(bold, title, 24, maxW).slice(0, 2)) {
    center(line, y, bold, 24, INK);
    y -= 30;
  }
  y -= 4;
  center([input.venue, input.eventDate].filter(Boolean).join('  ·  '), y, regular, 13, MUTED);

  // Footer: code on the left, how to verify on the right.
  const footerY = 66;
  page.drawText('CERTIFICATE CODE', { x: 64, y: footerY + 16, size: 8, font: bold, color: MUTED });
  page.drawText(input.code, { x: 64, y: footerY - 2, size: 16, font: mono, color: INK });
  const verifyLabel = 'VERIFY THIS CERTIFICATE';
  page.drawText(verifyLabel, { x: width - 64 - bold.widthOfTextAtSize(verifyLabel, 8), y: footerY + 16, size: 8, font: bold, color: MUTED });
  const verifyText = safeText(regular, `Verify at ${input.verifyUrl}`);
  const vs = fitSize(regular, verifyText, 11, 7, 360);
  page.drawText(verifyText, { x: width - 64 - regular.widthOfTextAtSize(verifyText, vs), y: footerY - 1, size: vs, font: regular, color: INK });
  center(`Issued ${input.issuedOn}`, footerY + 2, regular, 9, MUTED);

  return doc.save();
}
