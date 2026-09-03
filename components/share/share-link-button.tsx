"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useToast } from "@/components/toast";

type ShareLinkButtonProps = {
  /** The page this link opens. Must match lib/auth/guest-scope.ts's shape. */
  path: string;
  /** Used to name the pass so it's recognisable in the admin list. */
  title: string;
};

function defaultExpiry() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Creates a read-only share link for the page it sits on.
 *
 * The link is a guest pass pinned to this one path, so it opens this page and
 * nothing else — a link to the Silai fund doesn't also expose the event
 * reports. It expires on the chosen date and can be revoked from Guest
 * access at any point.
 */
export function ShareLinkButton({ path, title }: ShareLinkButtonProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [expiresOn, setExpiresOn] = useState(defaultExpiry);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/guest-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `Share link — ${title}`, expiresOn, scopePath: path })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Could not create the link");

      const url = `${window.location.origin}/s/${payload.code}`;
      setLink(url);
      // Offer the clipboard straight away — the code can never be shown
      // again, so a link the reader doesn't copy now is one they have to
      // recreate.
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        // Clipboard blocked; the link is on screen to copy by hand.
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create the link.", "error");
    } finally {
      setCreating(false);
    }
  }

  function close() {
    setOpen(false);
    setLink(null);
    setCopied(false);
    setExpiresOn(defaultExpiry());
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Share2 size={15} />
        Share
      </button>
    );
  }

  return (
    <div className="modal-backdrop no-print" role="presentation" onClick={close}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <h3>Share this page</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          Anyone with the link can view <strong>{title}</strong> — and only this page — until it
          expires. No sign-in needed, and nothing can be edited.
        </p>

        {link ? (
          <>
            <div className="code-display" style={{ marginBottom: 16 }}>
              <code style={{ flex: "1 1 220px", wordBreak: "break-all", fontSize: 13 }}>{link}</code>
              <button
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    showToast("Copy failed — select the link and copy it manually.", "error");
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="muted" style={{ fontSize: "var(--fs-small)" }}>
              Keep a copy — the link can&apos;t be shown again. Revoke it any time from Guest
              access.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={close}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={(event) => void create(event)}>
            <label className="field">
              <span>Link works until</span>
              <input
                className="input"
                type="date"
                required
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={creating}>
                <Share2 size={15} />
                {creating ? "Creating…" : "Create link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
