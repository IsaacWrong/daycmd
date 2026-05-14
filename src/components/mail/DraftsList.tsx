"use client";

import { deleteDraft, useDrafts } from "@/lib/gmail-client";

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function DraftsList({ selectedId, onSelect }: Props) {
  const { data, error } = useDrafts();
  const drafts = data && "drafts" in data ? data.drafts : [];

  if (error) {
    return (
      <div className="p-4 text-[12px]" style={{ color: "var(--c-error)" }}>
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-fg-soft text-[12px]">Loading…</div>;
  }
  if (drafts.length === 0) {
    return <div className="p-4 text-fg-soft text-[12px]">No drafts.</div>;
  }

  async function onDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await deleteDraft(id);
    } catch (err) {
      console.error("[mail]", (err as Error).message);
    }
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {drafts.map((d) => {
        const isSelected = d.id === selectedId;
        return (
          <li key={d.id}>
            <div
              className="mail-row"
              data-selected={isSelected}
              onClick={() => onSelect(d.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(d.id);
              }}
              style={{ position: "relative" }}
            >
              <div className="mail-row-header">
                <span className="mail-row-from">
                  {d.to || "(no recipient)"}
                </span>
                {d.isReply && <span className="mail-row-count">re</span>}
              </div>
              <div className="mail-row-subject">{d.subject || "(no subject)"}</div>
              <div className="mail-row-snippet">{d.snippet || "(empty)"}</div>

              <div className="mail-row-actions">
                <button
                  className="mail-row-action"
                  title="Delete draft"
                  onClick={(e) => onDelete(e, d.id)}
                >
                  🗑
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
