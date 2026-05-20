import type { CSSProperties } from "react";
import { FONT_SANS, type Palette } from "../palette";

export const Eyebrow: React.FC<{
  palette: Palette;
  children: string;
  style?: CSSProperties;
}> = ({ palette, children, style }) => (
  <div
    style={{
      fontFamily: FONT_SANS,
      fontSize: 10,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: palette.fgSoft,
      fontWeight: 500,
      ...style,
    }}
  >
    {children}
  </div>
);
