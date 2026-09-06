import { describe, expect, it } from "vitest";
import { reconcileCustomer, type ExistingCustomerRecord } from "./reconcile-customer";
import { mapZohoCustomer } from "./mappers";

function existing(
  stored: Partial<ExistingCustomerRecord["stored"]>,
  lastSynced: Partial<ExistingCustomerRecord["lastSynced"]> = {}
): ExistingCustomerRecord {
  return {
    stored: {
      display_name: null,
      company_name: null,
      email: null,
      phone: null,
      billing_address: null,
      ...stored
    },
    lastSynced: {
      display_name: null,
      company_name: null,
      email: null,
      phone: null,
      ...lastSynced
    }
  };
}

const ZOHO_CONTACT = {
  contact_id: "c1",
  contact_name: "Anand",
  company_name: "Anand Stores",
  email: "anand@example.com",
  phone: "9000000000"
};

describe("reconcileCustomer", () => {
  it("takes Zoho's copy wholesale for a customer we have never seen", () => {
    const merged = reconcileCustomer(mapZohoCustomer(ZOHO_CONTACT), undefined);

    expect(merged).toMatchObject({
      display_name: "Anand",
      company_name: "Anand Stores",
      email: "anand@example.com",
      phone: "9000000000"
    });
  });

  // The whole point of the ask: a number corrected in Zoho Books should stop
  // being wrong in the portal on the next sync.
  it("adjusts a field Zoho has changed since the last sync", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer({ ...ZOHO_CONTACT, phone: "9111111111", contact_name: "Anand Kumar" }),
      existing({ phone: "9000000000", display_name: "Anand" }, { phone: "9000000000", display_name: "Anand" })
    );

    expect(merged.phone).toBe("9111111111");
    expect(merged.display_name).toBe("Anand Kumar");
  });

  // ...without undoing the corrections the portal exists to let staff make.
  it("keeps a portal edit when Zoho's value hasn't moved", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer(ZOHO_CONTACT),
      existing(
        { phone: "9222222222", display_name: "Anand (Kalluri Salai)" },
        { phone: "9000000000", display_name: "Anand" }
      )
    );

    expect(merged.phone).toBe("9222222222");
    expect(merged.display_name).toBe("Anand (Kalluri Salai)");
  });

  it("lets a Zoho change win over a portal edit, since that is the newer fact", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer({ ...ZOHO_CONTACT, phone: "9333333333" }),
      existing({ phone: "9222222222" }, { phone: "9000000000" })
    );

    expect(merged.phone).toBe("9333333333");
  });

  it("never lets a blank in Zoho erase something the portal holds", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer({ contact_id: "c1", contact_name: "Anand" }),
      existing({ phone: "9222222222", email: "anand@example.com", company_name: "Anand Stores" })
    );

    expect(merged.phone).toBe("9222222222");
    expect(merged.email).toBe("anand@example.com");
    expect(merged.company_name).toBe("Anand Stores");
  });

  // The contacts list carries no address at all, so a sync that skipped the
  // per-contact detail call must not read its own silence as a deletion.
  it("keeps the stored address when this run didn't fetch contact detail", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer(ZOHO_CONTACT),
      existing({ billing_address: "12 Kalluri Salai" })
    );

    expect(merged.billing_address).toBe("12 Kalluri Salai");
  });

  it("takes the address from a detail payload that actually carries one", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer({
        ...ZOHO_CONTACT,
        billing_address: { street: "14 Kalluri Salai", city: "Chennai" }
      }),
      existing({ billing_address: "12 Kalluri Salai" })
    );

    expect(merged.billing_address).toBe("14 Kalluri Salai, Chennai");
  });

  it("does not write the unnamed-contact placeholder over a real stored name", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer({ contact_id: "c1" }),
      existing({ display_name: "Anand" }, { display_name: "Anand" })
    );

    expect(merged.display_name).toBe("Anand");
  });

  it("still leaves display_name populated when neither side has a name", () => {
    const merged = reconcileCustomer(mapZohoCustomer({ contact_id: "c1" }), existing({}));

    expect(merged.display_name).toBe("Unnamed customer");
  });

  // raw is what "what did Zoho say last time" is read from, so it has to stay
  // Zoho's payload and not the merged result.
  it("leaves the raw Zoho payload untouched", () => {
    const merged = reconcileCustomer(
      mapZohoCustomer(ZOHO_CONTACT),
      existing({ phone: "9222222222" }, { phone: "9000000000" })
    );

    expect((merged.raw as Record<string, unknown>).phone).toBe("9000000000");
  });
});
