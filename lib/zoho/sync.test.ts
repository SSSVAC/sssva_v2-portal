import { describe, expect, it } from "vitest";
import { mapZohoCustomer } from "./mappers";

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
