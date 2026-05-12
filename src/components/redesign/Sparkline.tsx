export function Sparkline({
  data,
  w = 60,
  h = 18,
  tone = "var(--fg)",
}: {
  data: number[];
  w?: number;
  h?: number;
  tone?: string;
}) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const stepX = w / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => [i * stepX, h - (v / max) * h * 0.9 - 1] as const);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join("");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg
      width={w}
      height={h}
      style={{ ["--c-tone" as string]: tone, display: "block" }}
    >
      <path d={area} className="spark-fill" />
      <path d={path} className="spark-stroke" />
    </svg>
  );
}
