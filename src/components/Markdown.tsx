"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-zinc-100 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="text-lg font-semibold text-zinc-50 mt-4 mb-2 first:mt-0" {...props} />
          ),
          h2: (props) => (
            <h2 className="text-base font-semibold text-zinc-100 mt-4 mb-2 first:mt-0" {...props} />
          ),
          h3: (props) => (
            <h3 className="text-sm font-semibold text-zinc-200 mt-3 mb-1.5 first:mt-0" {...props} />
          ),
          h4: (props) => (
            <h4 className="text-sm font-semibold text-zinc-200 mt-2 mb-1" {...props} />
          ),
          p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
          ul: (props) => (
            <ul className="my-2 ml-4 list-disc space-y-0.5 marker:text-zinc-600" {...props} />
          ),
          ol: (props) => (
            <ol className="my-2 ml-4 list-decimal space-y-0.5 marker:text-zinc-600" {...props} />
          ),
          li: (props) => <li className="leading-relaxed" {...props} />,
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:text-sky-300 underline underline-offset-2 decoration-sky-700"
            />
          ),
          strong: (props) => <strong className="text-zinc-50 font-semibold" {...props} />,
          em: (props) => <em className="italic text-zinc-200" {...props} />,
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
                  className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[0.85em] font-mono"
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
              className="my-2 p-3 rounded-md bg-zinc-950 border border-zinc-800 overflow-x-auto text-xs"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-2 pl-3 border-l-2 border-zinc-700 text-zinc-300 italic"
              {...props}
            />
          ),
          hr: () => <hr className="my-4 border-zinc-800" />,
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full text-xs border border-zinc-800" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-zinc-900" {...props} />,
          th: (props) => (
            <th className="text-left px-2 py-1.5 border-b border-zinc-800 font-semibold" {...props} />
          ),
          td: (props) => <td className="px-2 py-1.5 border-b border-zinc-900" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
