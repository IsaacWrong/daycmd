import type { CSSProperties, ReactNode } from "react";

export type SourceAccent =
  | "gmail"
  | "github"
  | "calendar"
  | "tasks"
  | "agent"
  | "obsidian"
  | "error"
  | "good";

export function Section({
  eyebrow,
  title,
  count,
  accent,
  right,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  count?: number;
  accent?: SourceAccent;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={"mb-10 " + (className ?? "")}>
      <header className="flex items-baseline gap-3 mb-4">
        {accent && <span className={`src-dot src-${accent}`} style={{ transform: "translateY(-2px)" }} />}
        {eyebrow && <span className="t-eyebrow">{eyebrow}</span>}
        {title && (
          <h3 className="m-0 text-[14px] font-medium" style={{ letterSpacing: "-0.005em" }}>
            {title}
          </h3>
        )}
        {typeof count === "number" && (
          <span className="t-mono t-num text-[11px] text-fg-soft" style={{ marginLeft: -4 }}>
            {count}
          </span>
        )}
        <span className="flex-1" />
        {right}
      </header>
      <hr className="hr-rule mb-4" />
      {children}
    </section>
  );
}

export function SectionMini({
  title,
  count,
  accent,
  right,
  children,
  className,
}: {
  title: string;
  count?: number;
  accent?: SourceAccent;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tone = accent ? `var(--c-${accent})` : "var(--fg)";
  return (
    <section
      className={"section-tinted mb-8 " + (className ?? "")}
      style={{ ["--c-tone" as string]: tone } as CSSProperties}
    >
      <div className="flex items-center gap-2 mb-3">
        {accent && <span className={`src-dot src-${accent}`} style={{ width: 6, height: 6 }} />}
        <span className="t-eyebrow">{title}</span>
        {typeof count === "number" && (
          <span className="t-mono t-num text-[10px] text-fg-soft">{count}</span>
        )}
        <span className="flex-1" />
        {right}
      </div>
      <hr className="hr-rule mb-3.5" />
      {children}
    </section>
  );
}
