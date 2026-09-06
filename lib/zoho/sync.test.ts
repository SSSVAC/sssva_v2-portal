import { describe, expect, it } from "vitest";
import { mapZohoCustomer } from "./mappers";
import { shouldRefuseArchive } from "./sync";
import { needsCustomerDetail } from "./client";

describe("customer sync mapping", () => {
  it("maps customer fields from Zoho payload into Supabase-compatible values", () => {
    const rawCustomer = {
      contact_id: "12345",
      contact_name: "Acme Corp",
      company_name: "Acme Holdings",
      email: "billing@acme.com",
      phone: "+1-555-0100",
      billing_address: "100 Main St",
      is_active: true,
      custom_field: "ignore-me"
    };

    const mapped = mapZohoCustomer(rawCustomer);

    expect(mapped).toMatchObject({
      zoho_customer_id: "12345",
      display_name: "Acme Corp",
      company_name: "Acme Holdings",
      email: "billing@acme.com",
      phone: "+1-555-0100",
      billing_address: "100 Main St",
      is_active: true
    });
    expect(mapped.raw).toMatchObject({
      contact_id: "12345",
      contact_name: "Acme Corp"
    });
  });

  it("falls back to defaults when optional customer fields are missing", () => {
    const mapped = mapZohoCustomer({
      contact_id: "999"
    });

    expect(mapped).toMatchObject({
      zoho_customer_id: "999",
      display_name: "Unnamed customer",
      company_name: null,
      email: null,
      phone: null,
      billing_address: null,
      is_active: true
    });
  });

  it("maps customer active state from Zoho status", () => {
    expect(
      mapZohoCustomer({
        contact_id: "active-customer",
        status: "active",
        is_active: false
      }).is_active
    ).toBe(true);

    expect(
      mapZohoCustomer({
        contact_id: "inactive-customer",
        status: "inactive",
        is_active: true
      }).is_active
    ).toBe(false);
  });

  it("reads billing address data from nested contact payloads", () => {
    const mapped = mapZohoCustomer({
      contact_id: "777",
      contact_name: "Northwind",
      contact: {
        address: {
          street: "10 Market St",
          city: "Seattle",
          state: "WA",
          zip: "98101"
        }
      }
    });

    expect(mapped.billing_address).toBe("10 Market St, Seattle, WA, 98101");
  });

  it("always clears archived_at on map, so a record reappearing in Zoho un-archives", () => {
    expect(mapZohoCustomer({ contact_id: "1" }).archived_at).toBeNull();
  });

  it("reads billing address data from Zoho contact detail payloads", () => {
    const mapped = mapZohoCustomer({
      contact_id: "7638915000000099228",
      contact_name: "Mr. Ganeshan Manimegalai",
      billing_address: {
        address_id: "7638915000000099231",
        attention: "",
        address: "Kalaignar Nagar 1st Street",
        street2: "",
        city: "",
        state_code: "",
        state: "",
        zip: "",
        country: "",
        county: "",
        latitude: "",
        longitude: "",
        country_code: "",
        phone: "",
        fax: ""
      }
    });

    expect(mapped).toMatchObject({
      zoho_customer_id: "7638915000000099228",
      display_name: "Mr. Ganeshan Manimegalai",
      billing_address: "Kalaignar Nagar 1st Street"
    });
  });
});

describe("archive guard", () => {
  // The failure this exists to stop: a Zoho fetch that comes back short (a
  // truncated list, half-failed pages) looks exactly like every record having
  // been deleted, and archiving on it empties the Records page.
  it("refuses a run that would archive most of a table", () => {
    expect(shouldRefuseArchive(2000, 2000)).toBe(true);
    expect(shouldRefuseArchive(2000, 500)).toBe(true);
  });

  it("allows the handful of real deletions a sync normally finds", () => {
    expect(shouldRefuseArchive(2000, 400)).toBe(false);
    expect(shouldRefuseArchive(2000, 12)).toBe(false);
  });

  // On a table of four records, deleting one is 25% and entirely ordinary.
  it("doesn't apply a percentage to a table too small for one to mean anything", () => {
    expect(shouldRefuseArchive(4, 3)).toBe(false);
    expect(shouldRefuseArchive(19, 19)).toBe(false);
    expect(shouldRefuseArchive(20, 20)).toBe(true);
  });
});

describe("customer detail call policy", () => {
  const listCustomer = { contact_id: "c1", last_modified_time: "2025-01-02T10:00:00+0530" };

  it("fetches detail for a customer never synced before", () => {
    expect(needsCustomerDetail(listCustomer, undefined)).toBe(true);
  });

  // The address only exists on the detail endpoint, so one that was never
  // captured keeps getting retried — the same backfill pattern bills use.
  it("fetches detail while the address is still missing", () => {
    expect(
      needsCustomerDetail(listCustomer, {
        hasBillingAddress: false,
        lastModifiedTime: "2025-01-02T10:00:00+0530"
      })
    ).toBe(true);
  });

  it("fetches detail when Zoho reports the contact changed since the last sync", () => {
    expect(
      needsCustomerDetail(listCustomer, {
        hasBillingAddress: true,
        lastModifiedTime: "2024-12-01T09:00:00+0530"
      })
    ).toBe(true);
  });

  // The point of the whole policy: an unchanged customer costs nothing.
  it("spends no call on a customer Zoho hasn't touched", () => {
    expect(
      needsCustomerDetail(listCustomer, {
        hasBillingAddress: true,
        lastModifiedTime: "2025-01-02T10:00:00+0530"
      })
    ).toBe(false);
  });
});
