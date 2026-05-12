import { format } from "date-fns";

/**
 * Convert Obsidian/moment-style format tokens to the date-fns equivalents
 * so we can render the same daily-note template that Obsidian uses.
 *
 * Only common tokens are covered. Bracketed literals "[X]" are preserved.
 */
function momentToDateFns(fmt: string): string {
  const tokens: Array<[RegExp, string]> = [
    // Day-of-week (longest first)
    [/\bdddd\b/g, "EEEE"],
    [/\bddd\b/g, "EEE"],
    // Year tokens
    [/\bgggg\b/g, "RRRR"],
    [/\bgg\b/g, "RR"],
    [/\bYYYY\b/g, "yyyy"],
    [/\bYY\b/g, "yy"],
    // Month
    [/\bMMMM\b/g, "MMMM"],
    [/\bMMM\b/g, "MMM"],
    [/\bMM\b/g, "MM"],
    [/(?<![A-Za-z])M(?![A-Za-z])/g, "M"],
    // Day of month
    [/\bDD\b/g, "dd"],
    [/(?<![A-Za-z])D(?![A-Za-z])/g, "d"],
    // ISO week
    [/\bww\b/g, "II"],
    [/(?<![A-Za-z])w(?![A-Za-z])/g, "I"],
    // Hours
    [/\bHH\b/g, "HH"],
    [/(?<![A-Za-z])H(?![A-Za-z])/g, "H"],
    [/\bhh\b/g, "hh"],
    [/(?<![A-Za-z])h(?![A-Za-z])/g, "h"],
    // Minutes
    [/\bmm\b/g, "mm"],
    [/(?<![A-Za-z])m(?![A-Za-z])/g, "m"],
    // Seconds
    [/\bss\b/g, "ss"],
    [/(?<![A-Za-z])s(?![A-Za-z])/g, "s"],
    // AM/PM
    [/(?<![A-Za-z])A(?![A-Za-z])/g, "aaaa"],
    [/(?<![A-Za-z])a(?![A-Za-z])/g, "aaa"],
  ];
  let out = fmt;
  for (const [re, rep] of tokens) out = out.replace(re, rep);
  // Bracket literals [X] → 'X' for date-fns.
  out = out.replace(/\[([^\]]*)\]/g, (_m, inner: string) => `'${inner.replace(/'/g, "''")}'`);
  return out;
}

function safeFormat(date: Date, fmt: string, fallback: string): string {
  try {
    return format(date, momentToDateFns(fmt));
  } catch {
    return fallback;
  }
}

export function renderTemplate(
  template: string,
  date: Date,
  opts: { title?: string } = {},
): string {
  return template
    .replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/g, (_m, fmt: string) =>
      safeFormat(date, fmt, format(date, "yyyy-MM-dd")),
    )
    .replace(/\{\{\s*date\s*\}\}/g, format(date, "yyyy-MM-dd"))
    .replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/g, (_m, fmt: string) =>
      safeFormat(date, fmt, format(date, "HH:mm")),
    )
    .replace(/\{\{\s*time\s*\}\}/g, format(date, "HH:mm"))
    .replace(/\{\{\s*title\s*\}\}/g, opts.title ?? format(date, "yyyy-MM-dd"));
}
