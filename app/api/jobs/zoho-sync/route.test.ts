import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClientMock, runZohoBooksSyncMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  runZohoBooksSyncMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock
}));

vi.mock("@/lib/zoho/sync", () => ({
  normalizeSyncOptions: (input?: unknown) => {
    if (typeof input === "string") {
      return {
        customers: input.includes("customers"),
        invoices: false,
        expenses: false,
        bills: false
      };
    }

    return {
      customers: true,
      invoices: true,
      expenses: true,
      bills: true
    };
  },
  runZohoBooksSync: runZohoBooksSyncMock
}));

import { POST } from "./route";

describe("zoho sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } })
      }
    });
    runZohoBooksSyncMock.mockResolvedValue({ ok: true });
  });

  it("passes sync_target from form data to the sync runner", async () => {
    const request = new NextRequest("http://localhost/api/jobs/zoho-sync", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ sync_target: "customers" }).toString()
    });

    await POST(request);

    expect(runZohoBooksSyncMock).toHaveBeenCalledWith({
      customers: true,
      invoices: false,
      expenses: false,
      bills: false
    });
  });
});
