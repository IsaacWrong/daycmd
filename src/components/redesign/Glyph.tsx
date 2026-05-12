type GlyphProps = { s?: number; c?: string };

export const Envelope = ({ s = 14, c = "currentColor" }: GlyphProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
    <rect x="1.6" y="3.4" width="12.8" height="9.2" rx="1.6" />
    <path d="M2 4l6 4.4 6-4.4" />
  </svg>
);

export const Branch = ({ s = 14, c = "currentColor" }: GlyphProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
    <circle cx="4" cy="3.5" r="1.5" />
    <circle cx="4" cy="12.5" r="1.5" />
    <circle cx="12" cy="6.5" r="1.5" />
    <path d="M4 5v6M4 9c0-2 2-3 4-3h2" />
  </svg>
);

export const Calendar = ({ s = 14, c = "currentColor" }: GlyphProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
    <rect x="2" y="3.5" width="12" height="10.5" rx="1.6" />
    <path d="M2 6.5h12M5 2v3M11 2v3" />
  </svg>
);

export const Note = ({ s = 14, c = "currentColor" }: GlyphProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
    <path d="M3.4 2.4h6L13 6v7.4a.6.6 0 0 1-.6.6H3.4a.6.6 0 0 1-.6-.6V3a.6.6 0 0 1 .6-.6z" />
    <path d="M9.4 2.4V6H13" />
    <path d="M5.6 9h5M5.6 11h3" />
  </svg>
);

export const Spark = ({ s = 14, c = "currentColor" }: GlyphProps) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 16 16"
    fill="none"
    stroke={c}
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 2v3M8 11v3M2 8h3M11 8h3M3.8 3.8l2.1 2.1M10.1 10.1l2.1 2.1M3.8 12.2l2.1-2.1M10.1 5.9l2.1-2.1" />
  </svg>
);

export const Sun = ({ s = 14, c = "currentColor" }: GlyphProps) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={c} strokeWidth="1.4">
    <circle cx="8" cy="8" r="3" />
    <path
      d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"
      strokeLinecap="round"
    />
  </svg>
);

export const Arrow = ({ s = 12, c = "currentColor" }: GlyphProps) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 16 16"
    fill="none"
    stroke={c}
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export const Paperclip = ({ s = 12, c = "currentColor" }: GlyphProps) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 16 16"
    fill="none"
    stroke={c}
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11.5 7.5L7 12a3 3 0 1 1-4.2-4.2l5.4-5.4a2 2 0 0 1 2.8 2.8L5.6 10.6a1 1 0 1 1-1.4-1.4l4.8-4.8" />
  </svg>
);

export const Star = ({ s = 12, c = "currentColor", fill = "none" }: GlyphProps & { fill?: string }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill={fill} stroke={c} strokeWidth="1.4" strokeLinejoin="round">
    <path d="M8 1.8l1.95 4 4.4.64-3.18 3.1.75 4.38L8 11.85 4.08 13.92l.75-4.38L1.65 6.44l4.4-.64z" />
  </svg>
);

export function todEmoji(tod: string): string {
  const map: Record<string, string> = {
    dawn: "🌅",
    morning: "🌤",
    noon: "☀",
    afternoon: "🌤",
    dusk: "🌇",
    night: "🌙",
    deep: "🌙",
  };
  return map[tod] ?? "🌤";
}
