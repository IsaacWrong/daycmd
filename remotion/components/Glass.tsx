import type { CSSProperties, ReactNode } from "react";
import type { Palette } from "../palette";

export const Glass: React.FC<{
  palette: Palette;
  children?: ReactNode;
  style?: CSSProperties;
  radius?: number;
  strong?: boolean;
}> = ({ palette, children, style, radius = 20, strong = false }) => {
  const bg = strong
    ? `linear-gradient(180deg, ${palette.bgA.replace(")", " / 0.32)").replace("oklch(", "oklch(")} 0%, ${palette.bgB.replace(")", " / 0.22)").replace("oklch(", "oklch(")} 100%)`
    : palette.glass;
  return (
    <div
      style={{
        background: bg,
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: `1px solid ${palette.glassBd}`,
        borderRadius: radius,
        boxShadow: `inset 0 1px 0 ${palette.glassHl}, 0 10px 28px ${palette.glassSh}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
