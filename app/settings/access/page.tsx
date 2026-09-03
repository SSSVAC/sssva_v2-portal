import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { GuestPassManager } from "@/components/settings/guest-pass-manager";
import { requireAdminViewer, viewerChrome } from "@/lib/auth/viewer";
import { guestSessionsEnabled } from "@/lib/auth/guest-pass";
import { GUEST_REPORT_CATEGORIES } from "@/lib/auth/guest-scope";
import { CATEGORY_META } from "@/lib/reports/registry";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type PassRow = Database["public"]["Tables"]["guest_passes"]["Row"];

export default async function GuestAccessPage() {
  const viewer = await requireAdminViewer();

  const { data: passes } = await viewer.supabase
    .from("guest_passes")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<PassRow[]>();

  const scope = GUEST_REPORT_CATEGORIES.map((category) => CATEGORY_META[category].short).join(" and ");

  return (
    <AppShell
      viewer={viewerChrome(viewer)}
      crumbs={[{ label: "Settings" }, { label: "Guest access" }]}
    >
      <PageHeader
        title="Guest access"
        description={`Issue a code to someone outside the committee. A guest can see the function trackers and the ${scope} reports, all read-only, until the pass expires or you revoke it.`}
      />

      <GuestPassManager
        passes={(passes ?? []).map((pass) => ({
          id: pass.id,
          label: pass.label,
          codeHint: pass.code_hint,
          expiresAt: pass.expires_at,
          revokedAt: pass.revoked_at,
          createdBy: pass.created_by,
          lastUsedAt: pass.last_used_at,
          useCount: pass.use_count,
          scopePath: pass.scope_path
        }))}
        enabled={guestSessionsEnabled()}
      />
    </AppShell>
  );
}
