// Spreadsheet reading for "Send from Excel". Everything runs in the browser; nothing is uploaded
// until the person presses Send. Uses SheetJS (xlsx 0.18.5).
import * as XLSX from 'xlsx';
import { cleanPhoneCell, fixGsm, pickRowPhone, renderRow, type PhoneCell } from './smsText';

export type Cell = string | number | boolean | null;

export interface SheetData {
  name: string;
  /** raw cell values (numbers stay numbers, so phones keep their digits) */
  raw: Cell[][];
  /** formatted text as Excel shows it (used to fill the message) */
  text: string[][];
  /** sheet row number (1-based, as Excel shows it) of raw[0] */
  firstRow: number;
  rowCount: number;
}

export interface Workbook { fileName: string; sheets: SheetData[] }

const isCsv = (name: string) => /\.(csv|txt)$/i.test(name);

export async function readWorkbook(file: File): Promise<Workbook> {
  let wb: XLSX.WorkBook;
  if (isCsv(file.name)) {
    // raw: keep every CSV value as typed (so "7.12346E+08" is not silently turned into a number)
    const text = await file.text();
    wb = XLSX.read(text, { type: 'string', raw: true });
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellNF: true, cellText: true });
  }
  const sheets: SheetData[] = wb.SheetNames.map((name) => toSheet(name, wb.Sheets[name])).filter((s) => s.rowCount > 0);
  return { fileName: file.name, sheets };
}

function toSheet(name: string, ws: XLSX.WorkSheet): SheetData {
  if (!ws || !ws['!ref']) return { name, raw: [], text: [], firstRow: 1, rowCount: 0 };
  // Fill merged cells across their range so merged headers ("MASOMO") apply to every column.
  for (const m of ws['!merges'] ?? []) {
    const src = ws[XLSX.utils.encode_cell(m.s)];
    if (!src) continue;
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++) {
        const a = XLSX.utils.encode_cell({ r, c });
        if (!ws[a] && (r === m.s.r)) ws[a] = { ...src };
      }
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  const raw: Cell[][] = [];
  const text: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rr: Cell[] = []; const tr: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!cell || cell.v === undefined || cell.v === null || cell.t === 'z' || cell.t === 'e') { rr.push(null); tr.push(''); continue; }
      rr.push(cell.v as Cell);
      tr.push(displayText(cell));
    }
    raw.push(rr); text.push(tr);
  }
  const rowCount = text.filter((r) => r.some((x) => x.trim())).length;
  return { name, raw, text, firstRow: range.s.r + 1, rowCount };
}

function displayText(cell: XLSX.CellObject): string {
  if (cell.t === 'n') {
    // Formatted text when it is meaningful (dates, 45.4, 150,000); never Excel's "7.12E+08" for big integers.
    const w = cell.w?.trim();
    if (w && !/e[+-]?\d+$/i.test(w)) return w;
    const v = cell.v as number;
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  }
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE';
  return String(cell.w ?? cell.v ?? '').trim();
}

/* ------------------------------------------------------------------ header detection */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();

const HEADER_WORDS = [
  'jina', 'name', 'majina', 'mwanafunzi', 'student', 'adm', 'admission', 'reg', 'namba', 'simu', 'phone', 'mobile', 'tel', 'msisdn',
  'contact', 'mawasiliano', 'mzazi', 'parent', 'guardian', 'mlezi', 's/n', 'sn', 'no', 'jinsia', 'sex', 'gender', 'class', 'darasa',
  'kidato', 'jumla', 'total', 'wastani', 'average', 'avg', 'grade', 'daraja', 'points', 'div', 'division', 'nafasi', 'position',
  'amount', 'balance', 'deni', 'ada', 'fee', 'fees', 'kiasi', 'tarehe', 'date', 'email', 'customer', 'mteja', 'member', 'mwanachama',
];
const SUBJECTS = ['civ', 'hist', 'geo', 'kisw', 'engl', 'eng', 'phy', 'chem', 'bio', 'b/math', 'math', 'hisabati', 'comm', 'lit', 'agric'];

function headerScore(row: string[]): number {
  const cells = row.map((c) => c.trim()).filter(Boolean);
  if (cells.length < 2) return -1;
  let s = 0;
  for (const c of cells) {
    const n = norm(c);
    if (!/[a-z]/.test(n)) { s -= 0.5; continue; } // numbers are data, not headers
    s += 1;
    const words = n.split(/[ /]/);
    if (HEADER_WORDS.some((w) => words.includes(w) || n === w)) s += 2;
    if (SUBJECTS.includes(n)) s += 1;
    if (c.length > 40) s -= 1;
  }
  return s;
}

/** Index (into sheet.text) of the most header-like row among the first 15 non-empty rows. */
export function detectHeaderRow(sheet: SheetData): number {
  let best = 0; let bestScore = -Infinity; let seen = 0;
  for (let i = 0; i < sheet.text.length && seen < 15; i++) {
    if (!sheet.text[i].some((x) => x.trim())) continue;
    seen++;
    const sc = headerScore(sheet.text[i]);
    if (sc > bestScore) { bestScore = sc; best = i; }
  }
  return best;
}

export interface Column { index: number; name: string }

const letter = (i: number) => XLSX.utils.encode_col(i);

export function columnsFor(sheet: SheetData, headerRow: number): Column[] {
  const head = sheet.text[headerRow] ?? [];
  const width = Math.max(...sheet.text.slice(headerRow, headerRow + 200).map((r) => r.length), head.length);
  const used = new Map<string, number>();
  const cols: Column[] = [];
  for (let i = 0; i < width; i++) {
    let name = (head[i] ?? '').replace(/\s+/g, ' ').replace(/[{}]/g, '').trim();
    const hasData = sheet.text.slice(headerRow + 1).some((r) => (r[i] ?? '').trim());
    if (!name && !hasData) continue;
    if (!name) name = `Column ${letter(i)}`;
    const k = name.toLowerCase();
    const n = (used.get(k) ?? 0) + 1;
    used.set(k, n);
    if (n > 1) name = `${name} (${n})`;
    cols.push({ index: i, name });
  }
  return cols;
}

/* ------------------------------------------------------------------ column guesses */

// Bilingual dictionary (field research §1.4). Order matters: earlier = stronger.
const PHONE_WORDS = [
  'namba ya mzazi', 'simu ya mzazi', 'namba ya simu', 'simu ya mlezi', 'parent phone', 'parents phone', 'phone number', 'mobile number',
  'simu', 'phone', 'mobile', 'msisdn', 'mawasiliano', 'tel', 'telephone', 'cell', 'contact', 'namba ya mlezi', 'mzazi/mlezi', 'whatsapp', 'number', 'namba',
];
const NAME_WORDS = [
  'jina la mwanafunzi', 'student name', 'jina kamili', 'full name', 'names of students', 'jina la mzazi', 'jina la mteja', 'customer name',
  'majina', 'jina', 'name', 'names', 'mwanafunzi', 'student', 'mteja', 'customer', 'member', 'mwanachama',
];

function dictScore(name: string, words: string[]): number {
  const n = norm(name).replace(/\s*\(\d+\)$/, '');
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (n === w) return 3 - i * 0.04;
    if (new RegExp(`(^|[ /])${w.replace(/[/]/g, '\\/')}([ /]|$)`).test(n)) return 2 - i * 0.04;
  }
  return 0;
}

function dataRows(sheet: SheetData, headerRow: number): number[] {
  const out: number[] = [];
  for (let i = headerRow + 1; i < sheet.text.length; i++) {
    const r = sheet.text[i];
    if (!r.some((x) => x.trim())) continue;
    const first = r.find((x) => x.trim()) ?? '';
    if (/^(wastani wa darasa|imesainiwa|signed|jumla kuu|grand total|prepared by|imeandaliwa)/i.test(first.trim())) break;
    out.push(i);
  }
  return out;
}

function phoneShare(sheet: SheetData, rows: number[], col: number): number {
  const vals = rows.map((i) => sheet.raw[i]?.[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (!vals.length) return 0;
  const good = vals.filter((v) => { const c = cleanPhoneCell(v); return c.phone || c.problem === 'excel_shortened'; }).length;
  return good / vals.length;
}

export interface Guess { phone: number | null; phone2: number | null; name: number | null }

export function guessColumns(sheet: SheetData, headerRow: number, cols: Column[]): Guess {
  const rows = dataRows(sheet, headerRow).slice(0, 300);
  const scored = cols.map((c) => {
    const share = phoneShare(sheet, rows, c.index);
    return { c, share, score: dictScore(c.name, PHONE_WORDS) + share * 3 };
  }).filter((x) => x.share >= 0.25 || (x.score >= 2 && x.share > 0)).sort((a, b) => b.score - a.score);
  const phone = scored[0]?.c.index ?? null;
  const second = scored.find((x) => x.c.index !== phone && (dictScore(x.c.name, PHONE_WORDS) > 0 || x.share >= 0.5));
  const nameCol = cols
    .map((c) => ({ c, s: dictScore(c.name, NAME_WORDS) }))
    .filter((x) => x.s > 0 && x.c.index !== phone && x.c.index !== second?.c.index)
    .sort((a, b) => b.s - a.s)[0];
  return { phone, phone2: second?.c.index ?? null, name: nameCol?.c.index ?? null };
}

/* ------------------------------------------------------------------ building the send */

export interface Problem { row: number; name: string; raw: string; reason: string; kind: PhoneCell['problem'] }

export interface Built {
  rows: { to: string; message: string; ref: string; fields: Record<string, string>; rowNumber: number; name: string }[];
  unsendable: Problem[];
  /** sendable rows that still need a look (e.g. Excel shortened the first number; the second column was used) */
  warnings: Problem[];
  segments: number;
  fixedChars: number;
  total: number;
}

/** Turn the sheet + choices into rendered, validated messages. Deterministic, no network. */
export function buildSend(sheet: SheetData, headerRow: number, cols: Column[], phoneCol: number, phone2Col: number | null, nameCol: number | null, template: string, countSegments: (t: string) => number): Built {
  const rows = dataRows(sheet, headerRow);
  const out: Built = { rows: [], unsendable: [], warnings: [], segments: 0, fixedChars: 0, total: rows.length };
  for (const i of rows) {
    const rowNumber = sheet.firstRow + i;
    const values: Record<string, string> = {};
    for (const c of cols) {
      const v = (sheet.text[i]?.[c.index] ?? '').trim();
      const f = fixGsm(v);
      out.fixedChars += f.changed;
      values[c.name] = f.text;
    }
    const name = nameCol !== null ? (sheet.text[i]?.[nameCol] ?? '').trim() : '';
    const p = pickRowPhone(sheet.raw[i]?.[phoneCol], phone2Col !== null ? sheet.raw[i]?.[phone2Col] : undefined);
    const rawText = String(sheet.raw[i]?.[phoneCol] ?? '').trim();
    if (!p.to) {
      out.unsendable.push({ row: rowNumber, name, raw: rawText, reason: p.primary.reason ?? 'No number', kind: p.primary.problem });
      continue;
    }
    if (p.primary.problem === 'excel_shortened')
      out.warnings.push({ row: rowNumber, name, raw: rawText, reason: 'Excel shortened this number - fix it in the sheet. Sent to the second number instead.', kind: p.primary.problem });
    const message = renderRow(template, values);
    out.segments += countSegments(message);
    out.rows.push({ to: p.to, message, ref: String(rowNumber), fields: values, rowNumber, name });
  }
  return out;
}

export function defaultGroupName(fileName: string) {
  return fileName.replace(/\.(xlsx|xls|csv|txt)$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 120) || 'From Excel';
}
