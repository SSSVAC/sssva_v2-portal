import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeSyncOptions, runZohoBooksSync } from "@/lib/zoho/sync";

export const dynamic = "force-dynamic";
// Full "Sync All" runs (customers + invoices + expenses + bills, with
// per-record detail-fetch backfills) can run past 60s; ask for the
// platform max and let Vercel clamp it to whatever the plan allows.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authorized = await isAuthorized(request);
  const wantsHtml = request.headers.get("accept")?.includes("text/html");

  if (!authorized) {
    if (wantsHtml) {
      return NextResponse.redirect(new URL("/login", request.url), 303);
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const selectedResources = await getRequestedResources(request);
    const result = await runZohoBooksSync(selectedResources);

    if (wantsHtml) {
      return NextResponse.redirect(new URL("/dashboard", request.url), 303);
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = getErrorMessage(error);

    if (wantsHtml) {
      return NextResponse.redirect(
        new URL(`/dashboard?sync_error=${encodeURIComponent(message)}`, request.url),
        303
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "zoho-sync",
      method: "POST"
    },
    { status: 200 }
  );
}

async function getRequestedResources(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await request.clone().json();

      if (payload && typeof payload === "object") {
        const syncTarget = (payload as { sync_target?: unknown }).sync_target;
        if (typeof syncTarget === "string") {
          return normalizeSyncOptions(syncTarget);
        }
      }
    } catch {
      // fall back to form parsing
    }
  }

  try {
    const formData = await request.clone().formData();
    const syncTarget = formData.get("sync_target");
    if (typeof syncTarget === "string") {
      return normalizeSyncOptions(syncTarget);
    }
  } catch {
    // fall through to query params
  }

  const searchParams = new URL(request.url).searchParams;
  const syncTarget = searchParams.get("sync_target");
  return normalizeSyncOptions(syncTarget ?? undefined);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Sync failed";
}

async function isAuthorized(request: NextRequest) {
  const syncSecret = process.env.SYNC_JOB_SECRET;
  const authorization = request.headers.get("authorization");

  if (syncSecret && authorization === `Bearer ${syncSecret}`) {
    return true;
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return Boolean(user);
}
