"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Section } from "@/components/ui/section";
import { SectionExportMenu } from "@/components/functions/function-export-menu";
import { EditableCell } from "@/components/ui/editable-cell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { formatCurrency } from "@/lib/format";
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABEL,
  ITEM_STATUS_PILL,
  itemStatus,
  type ItemRow,
  type SectionWithItems
} from "@/lib/functions/types";

type FunctionSectionCardProps = {
  section: SectionWithItems;
  /** Used to name exported files and scope this section's print target. */
  functionSlug: string;
  canEdit: boolean;
  isAdmin: boolean;
};

const STATUS_OPTIONS = ITEM_STATUSES.map((status) => ({
  value: status,
  label: ITEM_STATUS_LABEL[status]
}));

function money(value: number | null) {
  return value === null ? "" : String(value);
}

export function FunctionSectionCard({
  section,
  functionSlug,
  canEdit,
  isAdmin
}: FunctionSectionCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ItemRow | null>(null);

  async function save(entity: "items" | "sections", id: string, column: string, value: string) {
    const response = await fetch(`/api/functions/${entity}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, column, value })
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      showToast(detail?.error ?? "Could not save that change.", "error");
      throw new Error("save failed");
    }

    router.refresh();
  }

  async function addItem() {
    setAdding(true);
    try {
      const response = await fetch("/api/functions/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: section.id })
      });
      if (!response.ok) throw new Error("add failed");
      router.refresh();
    } catch {
      showToast("Could not add the item. Please try again.", "error");
    } finally {
      setAdding(false);
    }
  }

  async function deleteItem(item: ItemRow) {
    setPendingDelete(null);
    try {
      const response = await fetch("/api/functions/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      if (!response.ok) throw new Error("delete failed");
      showToast(`Removed “${item.name}”.`, "success");
      router.refresh();
    } catch {
      showToast("Could not remove that item.", "error");
    }
  }

  // Unique per page: one function renders at a time, and section ids are
  // unique within it.
  const printId = `function-section-${section.id}`;

  const isSchedule = section.kind === "schedule";
  const isMenu = section.kind === "menu";
  const readOnly = !canEdit;

  return (
    <>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove item"
        message={`Remove “${pendingDelete?.name ?? ""}” from ${section.title}?`}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => pendingDelete && void deleteItem(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      <Section
        title={
          <>
            {section.code && <span className="section-code">{section.code}</span>}
            {section.title}
          </>
        }
        count={section.items.length}
        printId={printId}
        actions={
          <>
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={adding}
                onClick={() => void addItem()}
              >
                <Plus size={14} />
                {adding ? "Adding…" : "Add item"}
              </button>
            )}
            <SectionExportMenu section={section} functionSlug={functionSlug} printId={printId} />
          </>
        }
      >
        {/* The section's own fields, as a form rather than a table row: an
            ubhayam or a vendor belongs to the whole section, and burying it
            in a footer cell is how the source documents made it easy to miss. */}
        <div className="section-form">
          {section.subtitle && <div className="section-form-note">{section.subtitle}</div>}

          <div className="field-inline">
            <span className="filter-label">Ubhayam / sponsor</span>
            <EditableCell
              value={section.sponsor ?? ""}
              placeholder="Unassigned"
              ariaLabel={`Sponsor for ${section.title}`}
              readOnly={readOnly}
              onSave={(value) => save("sections", section.id, "sponsor", value)}
            />
          </div>

          {isMenu && (
            <>
              <div className="field-inline">
                <span className="filter-label">Vendor / self</span>
                <EditableCell
                  value={section.vendor ?? ""}
                  placeholder="Not set"
                  ariaLabel={`Vendor for ${section.title}`}
                  readOnly={readOnly}
                  onSave={(value) => save("sections", section.id, "vendor", value)}
                />
              </div>
              <div className="field-inline">
                <span className="filter-label">Estimate</span>
                <EditableCell
                  value={money(section.estimate_amount)}
                  display={
                    section.estimate_amount === null ? undefined : formatCurrency(section.estimate_amount)
                  }
                  type="number"
                  ariaLabel={`Estimate for ${section.title}`}
                  readOnly={readOnly}
                  onSave={(value) => save("sections", section.id, "estimate_amount", value)}
                />
              </div>
              <div className="field-inline">
                <span className="filter-label">Advance paid</span>
                <EditableCell
                  value={money(section.advance_paid)}
                  display={section.advance_paid === null ? undefined : formatCurrency(section.advance_paid)}
                  type="number"
                  ariaLabel={`Advance paid for ${section.title}`}
                  readOnly={readOnly}
                  onSave={(value) => save("sections", section.id, "advance_paid", value)}
                />
              </div>
              <div className="field-inline">
                <span className="filter-label">Balance paid</span>
                <EditableCell
                  value={money(section.balance_paid)}
                  display={section.balance_paid === null ? undefined : formatCurrency(section.balance_paid)}
                  type="number"
                  ariaLabel={`Balance paid for ${section.title}`}
                  readOnly={readOnly}
                  onSave={(value) => save("sections", section.id, "balance_paid", value)}
                />
              </div>
            </>
          )}
        </div>

        {section.items.length === 0 ? (
          <div className="empty-state">
            <p>Nothing listed in this section yet.</p>
          </div>
        ) : (
          <div className="table-panel-scroll">
            <table className="data-table data-table-cards">
              <thead>
                {isSchedule ? (
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    {canEdit && <th aria-label="Actions" />}
                  </tr>
                ) : isMenu ? (
                  <tr>
                    <th>Menu item</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Status</th>
                    {canEdit && <th aria-label="Actions" />}
                  </tr>
                ) : (
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th className="num">Expected</th>
                    <th className="num">Actual</th>
                    <th>Ubhayam by</th>
                    <th>Status</th>
                    {canEdit && <th aria-label="Actions" />}
                  </tr>
                )}
              </thead>
              <tbody>
                {section.items.map((item) => {
                  const status = itemStatus(item.status);

                  return (
                    <tr key={item.id}>
                      {isSchedule && (
                        <td data-label="Time">
                          <EditableCell
                            value={item.time_label ?? ""}
                            ariaLabel={`Time for ${item.name}`}
                            readOnly={readOnly}
                            onSave={(value) => save("items", item.id, "time_label", value)}
                          />
                        </td>
                      )}

                      <td data-label={isSchedule ? "Event" : "Item"} className="data-table-card-title">
                        <EditableCell
                          value={item.name}
                          ariaLabel={`Name of ${item.name}`}
                          readOnly={readOnly}
                          onSave={(value) => save("items", item.id, "name", value)}
                        />
                      </td>

                      {!isSchedule && (
                        <td data-label="Qty">
                          <EditableCell
                            value={item.qty ?? ""}
                            ariaLabel={`Quantity for ${item.name}`}
                            readOnly={readOnly}
                            onSave={(value) => save("items", item.id, "qty", value)}
                          />
                        </td>
                      )}

                      {isMenu && (
                        <td data-label="Unit">
                          <EditableCell
                            value={item.unit ?? ""}
                            ariaLabel={`Unit for ${item.name}`}
                            readOnly={readOnly}
                            onSave={(value) => save("items", item.id, "unit", value)}
                          />
                        </td>
                      )}

                      {!isSchedule && !isMenu && (
                        <>
                          <td data-label="Expected" className="num">
                            <EditableCell
                              value={money(item.expected_amount)}
                              display={
                                item.expected_amount === null
                                  ? undefined
                                  : formatCurrency(item.expected_amount)
                              }
                              type="number"
                              align="right"
                              ariaLabel={`Expected amount for ${item.name}`}
                              readOnly={readOnly}
                              onSave={(value) => save("items", item.id, "expected_amount", value)}
                            />
                          </td>
                          <td data-label="Actual" className="num">
                            <EditableCell
                              value={money(item.actual_amount)}
                              display={
                                item.actual_amount === null ? undefined : formatCurrency(item.actual_amount)
                              }
                              type="number"
                              align="right"
                              ariaLabel={`Actual amount for ${item.name}`}
                              readOnly={readOnly}
                              onSave={(value) => save("items", item.id, "actual_amount", value)}
                            />
                          </td>
                          <td data-label="Ubhayam by">
                            <EditableCell
                              value={item.sponsor ?? ""}
                              placeholder={section.sponsor ? "Covered by section" : "Open"}
                              ariaLabel={`Sponsor for ${item.name}`}
                              readOnly={readOnly}
                              onSave={(value) => save("items", item.id, "sponsor", value)}
                            />
                          </td>
                        </>
                      )}

                      {!isSchedule && (
                        <td data-label="Status">
                          {readOnly ? (
                            <span className={`pill ${ITEM_STATUS_PILL[status]}`}>
                              {ITEM_STATUS_LABEL[status]}
                            </span>
                          ) : (
                            <EditableCell
                              value={status}
                              options={STATUS_OPTIONS}
                              ariaLabel={`Status for ${item.name}`}
                              onSave={(value) => save("items", item.id, "status", value)}
                            />
                          )}
                        </td>
                      )}

                      {canEdit && (
                        <td data-label="Remove">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            aria-label={`Remove ${item.name}`}
                            title="Remove item"
                            onClick={() => setPendingDelete(item)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>

              {!isSchedule && !isMenu && (
                <tfoot>
                  <tr>
                    <td colSpan={2}>Section total</td>
                    <td data-label="Expected" className="num">
                      {formatCurrency(section.totals.expected)}
                    </td>
                    <td data-label="Actual" className="num">
                      {formatCurrency(section.totals.actual)}
                    </td>
                    <td data-label="Ubhayam by">
                      {section.totals.sponsoredCount} of {section.totals.itemCount} covered
                    </td>
                    <td />
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {isAdmin && section.notes && <p className="section-form-note">{section.notes}</p>}
      </Section>
    </>
  );
}
