"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/toast";
import { SECTION_KINDS, type SectionKind } from "@/lib/functions/types";

export function AddSectionButton({ functionId }: { functionId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<SectionKind>("items");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/functions/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: functionId, title: title.trim(), kind })
      });
      if (!response.ok) throw new Error("failed");

      setOpen(false);
      setTitle("");
      setKind("items");
      router.refresh();
    } catch {
      showToast("Could not add the section. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Plus size={15} />
        Add section
      </button>
    );
  }

  return (
    <div className="modal-backdrop no-print" role="presentation" onClick={() => setOpen(false)}>
      <form
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
      >
        <h3>Add section</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          A section groups the items for one part of the function — a day, a pooja, or a meal.
        </p>

        <label className="field" style={{ marginBottom: 14 }}>
          <span>Title</span>
          <input
            className="input"
            autoFocus
            required
            value={title}
            placeholder="e.g. 15/09/2026 — கணபதி ஹோமம்"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Type</span>
          <select
            className="input"
            value={kind}
            onChange={(event) => setKind(event.target.value as SectionKind)}
          >
            {SECTION_KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} — {option.description}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving || !title.trim()}>
            {saving ? "Adding…" : "Add section"}
          </button>
        </div>
      </form>
    </div>
  );
}
