"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type EditableCellProps = {
  value: string;
  /** Rendered when not editing. Falls back to the raw value. */
  display?: ReactNode;
  placeholder?: string;
  type?: "text" | "number" | "date";
  options?: { value: string; label: string }[];
  /** Read-only viewers get the display value with no edit affordance at all. */
  readOnly?: boolean;
  ariaLabel: string;
  align?: "left" | "right";
  onSave: (value: string) => Promise<void>;
};

/**
 * Click-to-edit cell: Enter or blur commits, Escape cancels, a failed save
 * keeps the row marked so the edit can be retried rather than silently lost.
 *
 * Generic on purpose — it takes an onSave callback rather than knowing about
 * any endpoint, so the same interaction as the Records tables can be reused
 * by the function tracker without coupling the two. (Records still has its
 * own copy inside editable-data-table.tsx; converging them is worth doing,
 * but not in the same change that introduces this.)
 */
export function EditableCell({
  value,
  display,
  placeholder = "—",
  type = "text",
  options,
  readOnly = false,
  ariaLabel,
  align = "left",
  onSave
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The row can be re-rendered from fresh server data while this cell sits
  // idle; without this the cell would keep showing the value it had when it
  // last mounted.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit(next: string) {
    setEditing(false);
    if (next === value) return;

    setSaving(true);
    setFailed(false);
    try {
      await onSave(next);
    } catch {
      setFailed(true);
      setDraft(value);
    } finally {
      setSaving(false);
    }
  }

  const shown = display ?? (value === "" ? <span className="muted">{placeholder}</span> : value);

  if (readOnly) {
    return <>{shown}</>;
  }

  if (options) {
    return (
      <select
        className="cell-select"
        aria-label={ariaLabel}
        value={value}
        disabled={saving}
        onChange={(event) => void commit(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-input"
        type={type}
        aria-label={ariaLabel}
        value={draft}
        style={align === "right" ? { textAlign: "right" } : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(draft);
          }
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className={`editable-cell${failed ? " editable-cell-error" : ""}`}
      title={failed ? "Save failed — click to try again" : "Click to edit"}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setEditing(true);
        }
      }}
    >
      {saving ? <span className="muted">Saving…</span> : shown}
    </span>
  );
}
