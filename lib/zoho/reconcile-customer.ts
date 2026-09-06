import type { Database } from "@/types/database";
import { UNNAMED_CUSTOMER } from "@/lib/zoho/mappers";

type CustomerInsert = Database["public"]["Tables"]["zoho_customers"]["Insert"];

/**
 * What Supabase holds for a customer right now, alongside what Zoho said
 * about it at the last sync. The second half comes out of the stored `raw`
 * payload, so it costs no extra Zoho call to know whether a difference is
 * Zoho changing its mind or someone correcting the record in the portal.
 */
export type ExistingCustomerRecord = {
  /** The columns as they stand — including any correction made in the portal. */
  stored: {
    display_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    billing_address: string | null;
  };
  /** The same fields as Zoho last reported them. */
  lastSynced: {
    display_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

/**
 * Fields that exist on both sides — Zoho sends them on every contact, and
 * staff can edit them on the Records page.
 */
const MERGED_FIELDS = ["display_name", "company_name", "email", "phone"] as const;

/**
 * Decides one field's value when Zoho and the portal disagree.
 *
 * Three-way, against what Zoho said last time:
 *
 *   - Zoho sends nothing        → keep what we have. A blank in Zoho is
 *                                 missing data, not an instruction to erase
 *                                 a phone number someone typed in.
 *   - Zoho's value changed      → take it. This is the mismatch worth
 *                                 adjusting: the number really was updated
 *                                 in Zoho Books and the portal is stale.
 *   - Zoho's value is unchanged → keep what we have. A difference here can
 *                                 only be a correction made in the portal,
 *                                 and re-applying Zoho's unchanged copy over
 *                                 it would undo that edit on every sync.
 */
function resolveField(incoming: string | null, lastSynced: string | null, stored: string | null) {
  if (!incoming) return stored;
  if (incoming !== lastSynced) return incoming;
  return stored ?? incoming;
}

/**
 * Folds what Zoho just sent into what the portal already holds.
 *
 * A customer we've never seen passes straight through. For one we have, the
 * text fields go through resolveField, and the billing address takes Zoho's
 * only when Zoho actually sent one — the contacts *list* carries no address
 * at all, so a sync that skipped the per-contact detail call must not read
 * its own silence as "the address was deleted".
 */
export function reconcileCustomer(
  incoming: CustomerInsert,
  existing: ExistingCustomerRecord | undefined
): CustomerInsert {
  if (!existing) return incoming;

  const merged: CustomerInsert = { ...incoming };

  for (const field of MERGED_FIELDS) {
    // mapZohoCustomer substitutes a placeholder for a contact with no name;
    // that's a rendering fallback, not a value worth writing over a real one.
    const value = incoming[field] === UNNAMED_CUSTOMER ? null : incoming[field] ?? null;
    const resolved = resolveField(value, existing.lastSynced[field], existing.stored[field]);

    if (field === "display_name") {
      // NOT NULL, so it always needs something left to fall back to.
      merged.display_name = resolved || existing.stored.display_name || UNNAMED_CUSTOMER;
    } else {
      merged[field] = resolved;
    }
  }

  merged.billing_address = incoming.billing_address ?? existing.stored.billing_address;

  return merged;
}
