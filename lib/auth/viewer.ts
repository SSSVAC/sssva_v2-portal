import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GUEST_COOKIE_NAME, readGuestSessionToken } from "@/lib/auth/guest-pass";
import { guestCanAccessPath, guestLandingPath } from "@/lib/auth/guest-scope";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * @supabase/ssr and @supabase/supabase-js each generate their own generic
 * instantiation of SupabaseClient for the same Database type, and the two are
 * structurally incompatible even though the runtime query API is identical.
 * Normalising once here keeps every loader and query helper written against a
 * single client type instead of being generic over both.
 */
function asServerClient(admin: ReturnType<typeof createAdminClient>): SupabaseServerClient {
  return admin as unknown as SupabaseServerClient;
}

export type StaffViewer = {
  kind: "staff";
  supabase: SupabaseServerClient;
  user: User;
  email: string | null;
  isAdmin: boolean;
  isGuest: false;
  label: string;
};

export type GuestViewer = {
  kind: "guest";
  // Service-role client: a guest has no JWT, so RLS cannot authorise the read
  // for them. Everything a guest can reach is fixed by lib/auth/guest-scope.ts
  // and enforced by the page, never by the database — see the note there.
  supabase: SupabaseServerClient;
  user: null;
  email: null;
  isAdmin: false;
  isGuest: true;
  label: string;
  passId: string;
  expiresAt: Date;
  /** Set for a share link: the one page this pass may open. */
  scopePath: string | null;
};

export type Viewer = StaffViewer | GuestViewer;

/**
 * The part of a viewer the shell needs. A Viewer carries a Supabase client,
 * which can't cross the server/client boundary — this is what pages hand to
 * <AppShell>.
 */
export type ViewerChrome = {
  kind: "staff" | "guest";
  label: string;
  isAdmin: boolean;
  isGuest: boolean;
  /** ISO string, guests only — the shell shows when their access lapses. */
  expiresAt: string | null;
  /** Set for a share link, so the shell can hide navigation they can't use. */
  scopePath: string | null;
};

export function viewerChrome(viewer: Viewer): ViewerChrome {
  return {
    kind: viewer.kind,
    label: viewer.label,
    isAdmin: viewer.isAdmin,
    isGuest: viewer.isGuest,
    expiresAt: viewer.kind === "guest" ? viewer.expiresAt.toISOString() : null,
    scopePath: viewer.kind === "guest" ? viewer.scopePath : null
  };
}

/**
 * Resolves whoever is making this request: a signed-in staff member, or a
 * guest holding a valid pass. Returns null for neither.
 *
 * A guest pass is re-checked against the database on every request, not just
 * at sign-in — revoking a pass, or its expiry passing, has to take effect
 * immediately rather than whenever a cookie happens to lapse.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    return {
      kind: "staff",
      supabase,
      user,
      email: user.email ?? null,
      isAdmin: user.app_metadata?.is_admin === true,
      isGuest: false,
      label: user.email ?? "Staff"
    };
  }

  const cookieStore = await cookies();
  const claims = readGuestSessionToken(cookieStore.get(GUEST_COOKIE_NAME)?.value);
  if (!claims) return null;

  const admin = createAdminClient();
  // `select("*")` rather than a column list on purpose. Naming scope_path
  // explicitly would make this query — and therefore every existing guest
  // session — fail outright on a deployment where the share-link migration
  // hasn't been applied yet. With `*` the column is simply absent and the
  // pass falls back to unscoped, which is exactly what it was before.
  const { data: pass } = await admin
    .from("guest_passes")
    .select("*")
    .eq("id", claims.passId)
    .maybeSingle();

  if (!pass || pass.revoked_at || new Date(pass.expires_at) <= new Date()) {
    return null;
  }

  return {
    kind: "guest",
    supabase: asServerClient(admin),
    user: null,
    email: null,
    isAdmin: false,
    isGuest: true,
    label: pass.label,
    passId: pass.id,
    expiresAt: new Date(pass.expires_at),
    scopePath: pass.scope_path ?? null
  };
}

/** Any signed-in viewer, staff or guest. For pages on the guest allowlist. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/**
 * Staff only. Guests are bounced to their own home rather than the login
 * page — they are signed in, just not to this.
 */
export async function requireStaffViewer(): Promise<StaffViewer> {
  const viewer = await requireViewer();
  if (viewer.kind !== "staff") redirect(guestLandingPath(viewer.scopePath) as Route);
  return viewer;
}

/**
 * A viewer for a page a guest may reach, given that page's own path.
 *
 * Staff pass straight through. A guest holding a share link is sent back to
 * their own page rather than shown a 404, so following a stale bookmark
 * lands them somewhere useful instead of looking broken.
 */
export async function requireViewerForPath(pathname: string): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.kind === "guest" && !guestCanAccessPath(viewer.scopePath, pathname)) {
    redirect(guestLandingPath(viewer.scopePath) as Route);
  }
  return viewer;
}

export async function requireAdminViewer(): Promise<StaffViewer> {
  const viewer = await requireStaffViewer();
  if (!viewer.isAdmin) redirect("/dashboard");
  return viewer;
}
