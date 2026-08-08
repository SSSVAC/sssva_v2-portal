import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shared by every report page (and could replace the same three-times-
// duplicated block in app/dashboard/page.tsx and app/records/page.tsx too).
export async function requireAuthedSupabase() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return supabase;
}
