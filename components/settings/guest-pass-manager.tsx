"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Plus, RotateCw, Trash2, Undo2 } from "lucide-react";
import { Section } from "@/components/ui/section";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { formatDateOnly } from "@/lib/format";

export type GuestPassView = {
  id: string;
  label: string;
  codeHint: string;
  expiresAt: string;
  revokedAt: string | null;
  createdBy: string | null;
  lastUsedAt: string | null;
  useCount: number;
  /** Set for a share link: the single page it opens. */
  scopePath: string | null;
};

type Props = {
  passes: GuestPassView[];
  enabled: boolean;
};

type PassState = "active" | "revoked" | "expired";

function passState(pass: GuestPassView): PassState {
  if (pass.revokedAt) return "revoked";
  if (new Date(pass.expiresAt) <= new Date()) return "expired";
  return "active";
}

const STATE_PILL: Record<PassState, string> = {
  active: "pill-success",
  revoked: "pill-danger",
  expired: "pill-neutral"
};

const STATE_LABEL: Record<PassState, string> = {
  active: "Active",
  revoked: "Revoked",
  expired: "Expired"
};

function formatDate(value: string | null) {
  return value ? formatDateOnly(value) : "—";
}

/** Default expiry: a month out, which covers a normal festival window. */
function defaultExpiry() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function GuestPassManager({ passes, enabled }: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const [label, setLabel] = useState("");
  const [expiresOn, setExpiresOn] = useState(defaultExpiry);
  const [creating, setCreating] = useState(false);
  // Codes are stored hashed, so this is the only moment the plain code
  // exists anywhere. It stays on screen until dismissed rather than in a
  // toast that could vanish before it's been written down.
  const [issued, setIssued] = useState<{ label: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GuestPassView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, method: "POST" | "PATCH" | "DELETE") {
    const response = await fetch("/api/guest-passes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "Request failed");
    return payload;
  }

  async function createPass(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = await call({ label: label.trim(), expiresOn }, "POST");
      setIssued({ label: label.trim(), code: payload.code });
      setLabel("");
      setExpiresOn(defaultExpiry());
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create the pass.", "error");
    } finally {
      setCreating(false);
    }
  }

  async function act(pass: GuestPassView, action: string, extra: Record<string, unknown> = {}) {
    setBusyId(pass.id);
    try {
      const payload = await call({ id: pass.id, action, ...extra }, "PATCH");
      if (action === "regenerate" && payload?.code) {
        setIssued({ label: pass.label, code: payload.code });
      } else {
        showToast(`“${pass.label}” updated.`, "success");
      }
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "That didn't work.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function deletePass(pass: GuestPassView) {
    setPendingDelete(null);
    setBusyId(pass.id);
    try {
      await call({ id: pass.id }, "DELETE");
      showToast(`Deleted “${pass.label}”.`, "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete the pass.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Copy failed — select the code and copy it manually.", "error");
    }
  }

  if (!enabled) {
    return (
      <div className="panel">
        <div className="empty-state">
          <KeyRound size={22} />
          <p>
            Guest access is turned off. Set <code>GUEST_SESSION_SECRET</code> (any random string of
            16 characters or more) in your environment, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete guest pass"
        message={`Delete “${pendingDelete?.label ?? ""}”? Anyone still using its code loses access immediately.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => pendingDelete && void deletePass(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      {issued && (
        <div className="code-display">
          <div style={{ flex: "1 1 240px" }}>
            <div className="filter-label">Code for “{issued.label}”</div>
            <code>{issued.code}</code>
            <p className="muted" style={{ marginTop: 6, fontSize: "var(--fs-small)" }}>
              Copy it now — the code is stored hashed and can&apos;t be shown again. If it&apos;s
              lost, issue a new one from the list below.
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => void copyCode(issued.code)}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIssued(null)}>
            Done
          </button>
        </div>
      )}

      <Section title="Issue a pass">
        <form className="section-form" onSubmit={(event) => void createPass(event)}>
          <label className="field" style={{ flex: "2 1 220px" }}>
            <span>Who is it for?</span>
            <input
              className="input"
              required
              value={label}
              placeholder="e.g. Kalluri Salai contributors"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="field" style={{ flex: "1 1 160px" }}>
            <span>Access until</span>
            <input
              className="input"
              type="date"
              required
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          </label>
          <button type="submit" className="btn" disabled={creating || !label.trim()}>
            <Plus size={15} />
            {creating ? "Creating…" : "Create pass"}
          </button>
        </form>
      </Section>

      <Section title="Passes" count={passes.length}>
        {passes.length === 0 ? (
          <div className="empty-state">
            <p>No guest passes yet.</p>
          </div>
        ) : (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Opens</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Last used</th>
                  <th className="num">Uses</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {passes.map((pass) => {
                  const state = passState(pass);
                  const busy = busyId === pass.id;

                  return (
                    <tr key={pass.id}>
                      <td data-label="Label" className="data-table-card-title">
                        {pass.label}
                      </td>
                      <td data-label="Opens">
                        {pass.scopePath ? (
                          <>
                            <span className="pill pill-info">Link</span>{" "}
                            <span className="muted">{pass.scopePath}</span>
                          </>
                        ) : (
                          <>
                            <span className="pill pill-neutral">Code</span>{" "}
                            <span className="muted">••••-{pass.codeHint}</span>
                          </>
                        )}
                      </td>
                      <td data-label="Status">
                        <span className={`pill ${STATE_PILL[state]}`}>{STATE_LABEL[state]}</span>
                      </td>
                      <td data-label="Expires">
                        <input
                          type="date"
                          className="filter-input"
                          aria-label={`Expiry for ${pass.label}`}
                          defaultValue={pass.expiresAt.slice(0, 10)}
                          disabled={busy}
                          onChange={(event) =>
                            void act(pass, "expiry", { expiresOn: event.target.value })
                          }
                        />
                      </td>
                      <td data-label="Last used">{formatDate(pass.lastUsedAt)}</td>
                      <td data-label="Uses" className="num">
                        {pass.useCount}
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Issue a new code and invalidate the old one"
                            disabled={busy}
                            onClick={() => void act(pass, "regenerate")}
                          >
                            <RotateCw size={13} />
                            New code
                          </button>
                          {state === "revoked" ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => void act(pass, "restore")}
                            >
                              <Undo2 size={13} />
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => void act(pass, "revoke")}
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            aria-label={`Delete ${pass.label}`}
                            disabled={busy}
                            onClick={() => setPendingDelete(pass)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
