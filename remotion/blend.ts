import { TOD, type Palette, type ToD } from "./palette";

const parseOklch = (
  s: string,
): { l: number; c: number; h: number; a: number } => {
  const m = s.match(
    /oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\s*\)/,
  );
  if (!m) throw new Error(`bad oklch: ${s}`);
  return {
    l: parseFloat(m[1]!),
    c: parseFloat(m[2]!),
    h: parseFloat(m[3]!),
    a: m[4] ? parseFloat(m[4]) : 1,
  };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpHue = (a: number, b: number, t: number) => {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  let h = a + d * t;
  if (h < 0) h += 360;
  if (h >= 360) h -= 360;
  return h;
};

const mixOklch = (a: string, b: string, t: number): string => {
  const A = parseOklch(a);
  const B = parseOklch(b);
  const l = lerp(A.l, B.l, t);
  const c = lerp(A.c, B.c, t);
  const h = lerpHue(A.h, B.h, t);
  const al = lerp(A.a, B.a, t);
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(2)} / ${al.toFixed(3)})`;
};

export const mixPalettes = (a: Palette, b: Palette, t: number): Palette => {
  const keys = Object.keys(a) as (keyof Palette)[];
  const out: Partial<Palette> = {};
  for (const k of keys) {
    out[k] = mixOklch(a[k], b[k], t);
  }
  return out as Palette;
};

export const todAt = (stops: { tod: ToD; at: number }[], t: number): Palette => {
  if (t <= stops[0]!.at) return TOD[stops[0]!.tod];
  if (t >= stops[stops.length - 1]!.at) return TOD[stops[stops.length - 1]!.tod];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (t >= a.at && t <= b.at) {
      const local = (t - a.at) / (b.at - a.at);
      return mixPalettes(TOD[a.tod], TOD[b.tod], local);
    }
  }
  return TOD[stops[0]!.tod];
};
