"use client";

import { useEffect, useRef } from "react";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  Decoration,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
  keymap,
  drawSelection,
  highlightActiveLine,
} from "@codemirror/view";
import {
  HighlightStyle,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { tags as t, Tag } from "@lezer/highlight";
import type { MarkdownConfig } from "@lezer/markdown";

// ── Wikilink extension for Lezer markdown ──────────────────────────────
const wikilinkTag = Tag.define();

const Wikilink: MarkdownConfig = {
  defineNodes: [
    { name: "Wikilink", style: wikilinkTag },
    { name: "WikilinkMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Wikilink",
      parse(cx, next, pos) {
        if (next !== 91 /* [ */ || cx.char(pos + 1) !== 91) return -1;
        const end = cx.text.indexOf("]]", pos - cx.offset + 2);
        if (end < 0) return -1;
        const absEnd = end + cx.offset + 2;
        return cx.addElement(
          cx.elt("Wikilink", pos, absEnd, [
            cx.elt("WikilinkMark", pos, pos + 2),
            cx.elt("WikilinkMark", absEnd - 2, absEnd),
          ]),
        );
      },
    },
  ],
};

// ── Highlight style: maps tags → CSS classes ───────────────────────────
const obsidianHighlight = HighlightStyle.define([
  { tag: t.heading1, class: "cm-h1" },
  { tag: t.heading2, class: "cm-h2" },
  { tag: t.heading3, class: "cm-h3" },
  { tag: t.heading4, class: "cm-h4" },
  { tag: t.heading5, class: "cm-h5" },
  { tag: t.heading6, class: "cm-h6" },
  { tag: t.strong, class: "cm-strong" },
  { tag: t.emphasis, class: "cm-em" },
  { tag: t.strikethrough, class: "cm-strike" },
  { tag: t.monospace, class: "cm-code" },
  { tag: t.link, class: "cm-link" },
  { tag: t.url, class: "cm-url" },
  { tag: t.quote, class: "cm-quote" },
  { tag: t.list, class: "cm-list" },
  { tag: t.processingInstruction, class: "cm-mark" },
  { tag: t.contentSeparator, class: "cm-hr" },
  { tag: wikilinkTag, class: "cm-wikilink" },
]);

// ── Task checkbox widget ───────────────────────────────────────────────
class TaskWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: TaskWidget) {
    return other.checked === this.checked;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("span");
    box.className = "cm-task-box" + (this.checked ? " cm-task-checked" : "");
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.contentEditable = "false";
    box.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = this.checked ? "[ ]" : "[x]";
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: next },
      });
    };
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

// ── Live-preview: hide markdown markers, swap task markers for checkbox ─
const decoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) {
        this.decorations = this.build(u.view);
      }
    }
    build(view: EditorView): DecorationSet {
      const builds: { from: number; to: number; deco: Decoration }[] = [];
      const sel = view.state.selection.main;
      const doc = view.state.doc;
      const activeLines = new Set<number>();
      for (let p = sel.from; p <= sel.to; p++) {
        activeLines.add(doc.lineAt(Math.min(p, doc.length)).number);
      }
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            const name = node.name;
            const line = doc.lineAt(node.from).number;
            const onActive = activeLines.has(line);

            // Task checkboxes — replace `[ ]` / `[x]` with widget regardless
            // of active line (Obsidian renders them always). Cursor still
            // navigable around the widget.
            if (name === "TaskMarker") {
              const text = view.state.sliceDoc(node.from, node.to);
              const checked = /\[[xX]\]/.test(text);
              builds.push({
                from: node.from,
                to: node.to,
                deco: Decoration.replace({
                  widget: new TaskWidget(checked, node.from, node.to),
                  inclusive: false,
                }),
              });
              return;
            }

            if (onActive) return;

            if (
              name === "HeaderMark" ||
              name === "EmphasisMark" ||
              name === "StrikethroughMark" ||
              name === "CodeMark" ||
              name === "QuoteMark" ||
              name === "LinkMark" ||
              name === "WikilinkMark"
            ) {
              let endPos = node.to;
              if (name === "HeaderMark") {
                const slice = view.state.sliceDoc(node.to, node.to + 1);
                if (slice === " ") endPos = node.to + 1;
              }
              builds.push({
                from: node.from,
                to: endPos,
                deco: Decoration.replace({}),
              });
            }
          },
        });
      }
      builds.sort((a, b) => a.from - b.from || a.to - b.to);
      const b = new RangeSetBuilder<Decoration>();
      for (const { from, to, deco } of builds) b.add(from, to, deco);
      return b.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

// ── Wikilink click → custom event ──────────────────────────────────────
const wikilinkClick = EditorView.domEventHandlers({
  mousedown(e, view) {
    const target = e.target as HTMLElement;
    const el = target.closest(".cm-wikilink");
    if (!el) return false;
    const pos = view.posAtDOM(el);
    const node = syntaxTree(view.state).resolveInner(pos, 1);
    let wl = node;
    while (wl && wl.name !== "Wikilink") {
      if (!wl.parent) break;
      wl = wl.parent;
    }
    if (!wl || wl.name !== "Wikilink") return false;
    const raw = view.state.sliceDoc(wl.from + 2, wl.to - 2);
    const [target_, alias] = raw.split("|");
    e.preventDefault();
    window.dispatchEvent(
      new CustomEvent("obsidian:open-wikilink", {
        detail: { target: target_.trim(), alias: alias?.trim() },
      }),
    );
    return true;
  },
});

// ── Theme: maps to Daycmd tokens ───────────────────────────────────────
const obsidianTheme = EditorView.theme({
  "&": {
    color: "var(--fg)",
    backgroundColor: "transparent",
    height: "100%",
    fontSize: "15px",
  },
  "&.cm-editor": {
    outline: "none",
  },
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily:
      "var(--font-sans), ui-sans-serif, system-ui, -apple-system, sans-serif",
    lineHeight: "1.65",
    overflow: "auto",
    padding: "4px 4px 40vh 4px",
  },
  ".cm-content": {
    caretColor: "var(--fg)",
    padding: 0,
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeft: "1.5px solid var(--fg)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    {
      background: "oklch(from var(--c-obsidian) l c h / 0.22) !important",
    },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-h1": {
    fontSize: "1.7em",
    fontWeight: "700",
    lineHeight: "1.25",
    letterSpacing: "-0.02em",
  },
  ".cm-h2": {
    fontSize: "1.38em",
    fontWeight: "650",
    lineHeight: "1.3",
    letterSpacing: "-0.018em",
  },
  ".cm-h3": {
    fontSize: "1.18em",
    fontWeight: "600",
    lineHeight: "1.35",
    letterSpacing: "-0.012em",
  },
  ".cm-h4, .cm-h5, .cm-h6": {
    fontSize: "1.05em",
    fontWeight: "600",
  },
  ".cm-strong": { fontWeight: "700", color: "var(--fg)" },
  ".cm-em": { fontStyle: "italic" },
  ".cm-strike": { textDecoration: "line-through", color: "var(--fg-soft)" },
  ".cm-code": {
    fontFamily:
      "var(--font-mono), ui-monospace, 'SF Mono', Menlo, monospace",
    fontSize: "0.92em",
    background: "oklch(from var(--fg) l c h / 0.06)",
    padding: "1px 5px",
    borderRadius: "4px",
  },
  ".cm-link": { color: "var(--c-obsidian)" },
  ".cm-url": { color: "var(--fg-soft)" },
  ".cm-quote": {
    color: "var(--fg-soft)",
    fontStyle: "italic",
    borderLeft: "2px solid var(--rule)",
    paddingLeft: "10px",
  },
  ".cm-list": { color: "var(--fg)" },
  ".cm-mark": { color: "var(--fg-soft)", opacity: "0.55" },
  ".cm-hr": { color: "var(--fg-soft)" },
  ".cm-wikilink": {
    color: "var(--c-obsidian)",
    background: "oklch(from var(--c-obsidian) l c h / 0.08)",
    padding: "1px 5px",
    borderRadius: "4px",
    textDecoration: "none",
    cursor: "pointer",
    transition: "background 120ms ease",
  },
  ".cm-wikilink:hover": {
    background: "oklch(from var(--c-obsidian) l c h / 0.18)",
  },
  ".cm-task-box": {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "1.4px solid var(--fg-soft)",
    borderRadius: "4px",
    verticalAlign: "-2px",
    marginRight: "6px",
    cursor: "pointer",
    background: "transparent",
    transition: "background 120ms ease, border-color 120ms ease",
    position: "relative",
  },
  ".cm-task-box:hover": {
    borderColor: "var(--fg)",
  },
  ".cm-task-checked": {
    background: "var(--c-obsidian)",
    borderColor: "var(--c-obsidian)",
  },
  ".cm-task-checked::after": {
    content: '""',
    position: "absolute",
    left: "3px",
    top: "0px",
    width: "4px",
    height: "8px",
    borderRight: "1.6px solid var(--bg-a)",
    borderBottom: "1.6px solid var(--bg-a)",
    transform: "rotate(45deg)",
  },
});

export function ObsidianEditor({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const extensions: Extension[] = [
      history(),
      drawSelection(),
      highlightActiveLine(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      markdown({
        base: markdownLanguage,
        extensions: [Wikilink],
        addKeymap: true,
      }),
      syntaxHighlighting(obsidianHighlight),
      decoPlugin,
      wikilinkClick,
      obsidianTheme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current(u.state.doc.toString());
      }),
    ];

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({ doc: value, extensions }),
    });
    viewRef.current = view;
    if (autoFocus) view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      className="scroll flex-1 min-h-0 w-full"
      style={{ display: "flex", flexDirection: "column" }}
    />
  );
}
