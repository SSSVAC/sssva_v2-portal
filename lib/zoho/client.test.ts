import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchZohoCustomers, fetchZohoInvoices } from "./client";

describe("fetchZohoCustomers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ZOHO_BOOKS_BASE_URL = "https://www.zohoapis.com/books/v3";
    process.env.ZOHO_ORGANIZATION_ID = "org-123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("respects the provided test limit when fetching customers", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/contacts?")) {
        if (new URL(url).searchParams.get("page") === "2") {
          return {
            ok: true,
            json: async () => ({
              contacts: []
            })
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            contacts: [
              { contact_id: "1", contact_name: "Alpha" },
              { contact_id: "2", contact_name: "Beta" }
            ]
          })
        } as Response;
      }

      if (url.includes("/contacts/")) {
        return {
          ok: true,
          json: async () => ({
            contact: { contact_id: "1", contact_name: "Alpha" }
          })
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({})
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchZohoCustomers("token", 2);

    expect(result).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("falls back to the list record when a detail lookup returns null", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/contacts?")) {
        return {
          ok: true,
          json: async () => ({
            contacts: [{ contact_id: "42", contact_name: "Fallback" }]
          })
        } as Response;
      }

      if (url.includes("/contacts/")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({})
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({})
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchZohoCustomers("token", 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ contact_id: "42", contact_name: "Fallback" });
  });

  it("retries customer detail requests when Zoho returns 429", async () => {
    let detailAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/contacts?")) {
        return {
          ok: true,
          json: async () => ({
            contacts: [{ contact_id: "429", contact_name: "Rate Limited" }]
          })
        } as Response;
      }

      if (url.includes("/contacts/")) {
        detailAttempts += 1;

        if (detailAttempts === 1) {
          return {
            ok: false,
            status: 429,
            headers: new Headers({ "retry-after": "0" }),
            json: async () => ({})
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            contact: { contact_id: "429", contact_name: "Rate Limited Detail" }
          })
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({})
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchZohoCustomers("token", 1);

    expect(detailAttempts).toBe(2);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ contact_id: "429", contact_name: "Rate Limited Detail" });
  });

  it("fetches additional contact pages until the requested limit is reached", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/contacts?")) {
        if (new URL(url).searchParams.get("page") === "2") {
          return {
            ok: true,
            json: async () => ({
              contacts: [
                { contact_id: "3", contact_name: "Gamma" },
                { contact_id: "4", contact_name: "Delta" }
              ],
              page_context: { has_more_page: false }
            })
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            contacts: [
              { contact_id: "1", contact_name: "Alpha" },
              { contact_id: "2", contact_name: "Beta" }
            ],
            page_context: { has_more_page: true }
          })
        } as Response;
      }

      if (url.includes("/contacts/")) {
        return {
          ok: true,
          json: async () => ({
            contact: { contact_id: "1", contact_name: "Alpha" }
          })
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({})
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchZohoCustomers("token", 4);

    expect(result).toHaveLength(4);
  });
});

describe("fetchZohoInvoices", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ZOHO_BOOKS_BASE_URL = "https://www.zohoapis.com/books/v3";
    process.env.ZOHO_ORGANIZATION_ID = "org-123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("fetches invoice pages while Zoho reports more pages", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/invoices?")) {
        const page = new URL(url).searchParams.get("page");

        if (page === "1") {
          return {
            ok: true,
            json: async () => ({
              invoices: [{ invoice_id: "1" }, { invoice_id: "2" }],
              page_context: { has_more_page: true }
            })
          } as Response;
        }

        if (page === "2") {
          return {
            ok: true,
            json: async () => ({
              invoices: [{ invoice_id: "3" }],
              page_context: { has_more_page: false }
            })
          } as Response;
        }
      }

      return {
        ok: true,
        json: async () => ({})
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchZohoInvoices("token");

    expect(result).toEqual([{ invoice_id: "1" }, { invoice_id: "2" }, { invoice_id: "3" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
