"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div
      className="prose prose-sm max-w-none leading-relaxed"
      style={{ color: "var(--fg)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1
              className="text-lg font-semibold mt-4 mb-2 first:mt-0"
              style={{ color: "var(--fg)" }}
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="text-base font-semibold mt-4 mb-2 first:mt-0"
              style={{ color: "var(--fg)" }}
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="text-sm font-semibold mt-3 mb-1.5 first:mt-0"
              style={{ color: "var(--fg)" }}
              {...props}
            />
          ),
          h4: (props) => (
            <h4
              className="text-sm font-semibold mt-2 mb-1"
              style={{ color: "var(--fg)" }}
              {...props}
            />
          ),
          p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
          ul: (props) => (
            <ul
              className="my-2 ml-4 list-disc space-y-0.5"
              style={{ ["--tw-prose-bullets" as string]: "var(--fg-soft)" }}
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              className="my-2 ml-4 list-decimal space-y-0.5"
              style={{ ["--tw-prose-counters" as string]: "var(--fg-soft)" }}
              {...props}
            />
          ),
          li: (props) => <li className="leading-relaxed" {...props} />,
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
              style={{ color: "var(--c-calendar)" }}
            />
          ),
          strong: (props) => (
            <strong className="font-semibold" style={{ color: "var(--fg)" }} {...props} />
          ),
          em: (props) => (
            <em className="italic" style={{ color: "var(--fg)" }} {...props} />
          ),
          code: ({
            inline,
            className,
            children,
            ...rest
          }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
          }) => {
            if (inline) {
              return (
                <code
                  className="px-1 py-0.5 rounded text-[0.85em] font-mono"
                  style={{
                    background: "oklch(from var(--fg) l c h / 0.08)",
                    color: "var(--fg)",
                  }}
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className ?? ""} text-xs font-mono`} {...rest}>
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre
              className="my-2 p-3 rounded-md overflow-x-auto text-xs"
              style={{
                background: "oklch(from var(--fg) l c h / 0.06)",
                border: "1px solid var(--rule)",
                color: "var(--fg)",
              }}
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-2 pl-3 italic"
              style={{
                borderLeft: "2px solid var(--rule)",
                color: "var(--fg-soft)",
              }}
              {...props}
            />
          ),
          hr: () => <hr className="my-4" style={{ borderColor: "var(--rule)" }} />,
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table
                className="min-w-full text-xs"
                style={{ border: "1px solid var(--rule)" }}
                {...props}
              />
            </div>
          ),
          thead: (props) => (
            <thead
              style={{ background: "oklch(from var(--fg) l c h / 0.06)" }}
              {...props}
            />
          ),
          th: (props) => (
            <th
              className="text-left px-2 py-1.5 font-semibold"
              style={{ borderBottom: "1px solid var(--rule)" }}
              {...props}
            />
          ),
          td: (props) => (
            <td
              className="px-2 py-1.5"
              style={{ borderBottom: "1px solid var(--rule)" }}
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
