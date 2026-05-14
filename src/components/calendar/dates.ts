export const DAY_MS = 86400000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Week starts Sunday (0).
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  return new Date(addDays(s, 6).getTime() + DAY_MS - 1);
}

// 6-week grid covering month + leading/trailing days.
export function monthGridRange(cursor: Date): { from: Date; to: Date } {
  const from = startOfWeek(startOfMonth(cursor));
  const to = new Date(addDays(from, 41).getTime() + DAY_MS - 1);
  return { from, to };
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtWeekRange(d: Date): string {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  const sameMonth = s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString(undefined, { month: "short" })} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function fmtDayLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Parse Google event start/end. Date-only strings ("YYYY-MM-DD") become local
// midnight; full ISO datetimes parse normally.
export function parseEventTime(s: string): number {
  if (!s) return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  }
  return new Date(s).getTime();
}
