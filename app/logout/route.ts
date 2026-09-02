import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GUEST_COOKIE_NAME } from "@/lib/auth/guest-pass";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // A guest has no Supabase session to sign out of — their session is this
  // cookie, so clear it too rather than leaving them signed in as a guest
  // after pressing Sign out.
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE_NAME);

  redirect("/login");
}
