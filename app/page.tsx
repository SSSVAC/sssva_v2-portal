import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { GUEST_HOME } from "@/lib/auth/guest-scope";

export default async function HomePage() {
  const viewer = await getViewer();

  if (!viewer) redirect("/login");
  redirect(viewer.kind === "guest" ? GUEST_HOME : "/dashboard");
}
