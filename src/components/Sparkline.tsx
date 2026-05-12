"use client";

export function Sparkline({
  values,
  width = 80,
  height = 20,
  color = "#60a5fa",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 0.001);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (values.length - 1) * stepX;
  const lastY = height - (values[values.length - 1] / max) * (height - 2) - 1;
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={1.8} fill={color} />
    </svg>
  );
}
