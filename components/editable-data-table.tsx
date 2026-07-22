"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

export type RecordColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "date" | "select";
  editable: boolean;
  // For type "select": fixed dropdown options. If omitted, options are
  // derived from whatever distinct values already exist for this column
  // across all rows, plus an "Add new…" entry to introduce one.
  options?: string[];
  // For type "select": label shown for a null/empty value, and offered as
  // an explicit option that saves null (e.g. "Others" for an unset group).
  emptyLabel?: string;
};

type RowValue = string | number | boolean | null;
type Row = Record<string, unknown>;

const ADD_NEW_OPTION_VALUE = "__add_new__";
const EMPTY_FILTER_VALUE = "__empty__";

type ActionColumn = {
  label: string;
  render: (row: Row) => ReactNode;
};

type EditableDataTableProps = {
  table: string;
  columns: RecordColumn[];
  rows: Row[];
  actionColumn?: ActionColumn;
  presetFilter?: (row: Row) => boolean;
  isAdmin?: boolean;
};

export function EditableDataTable({
  table,
  columns,
  rows: initialRows,
  actionColumn,
  presetFilter,
  isAdmin = false
}: EditableDataTableProps) {
  const [rows, setRows] = useState(initialRows);
  const { showToast } = useToast();

  // Picks up fresh data after resyncSelected() below triggers router.refresh();
  // initialRows otherwise only changes across full navigations, not re-renders.
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addingOptionCell, setAddingOptionCell] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [errorCell, setErrorCell] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const router = useRouter();

  const derivedSelectOptions = useMemo(() => {
    const map: Record<string, string[]> = {};

    columns.forEach((column) => {
      if (column.type !== "select" || column.options) return;

      const values = new Set<string>();
      rows.forEach((row) => {
        const value = row[column.key];
        if (typeof value === "string" && value.trim() !== "") {
          values.add(value);
        }
      });

      map[column.key] = Array.from(values).sort((a, b) => a.localeCompare(b));
    });

    return map;
  }, [columns, rows]);

  function selectOptionsFor(column: RecordColumn) {
    return column.options ?? derivedSelectOptions[column.key] ?? [];
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (presetFilter && !presetFilter(row)) return false;

      return columns.every((column) => {
        const filterValue = filters[column.key];
        if (!filterValue) return true;

        if (column.type === "boolean") {
          return String(Boolean(row[column.key])) === filterValue;
        }

        if (column.type === "select" && filterValue === EMPTY_FILTER_VALUE) {
          const raw = row[column.key];
          return raw === null || raw === undefined || raw === "";
        }

        return String(row[column.key] ?? "")
          .toLowerCase()
          .includes(filterValue.toLowerCase());
      });
    });
  }, [rows, filters, columns, presetFilter]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;

    const column = columns.find((candidate) => candidate.key === sort.key);
    const factor = sort.direction === "asc" ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      const aValue = a[sort.key];
      const bValue = b[sort.key];
      const aEmpty = aValue === null || aValue === undefined || aValue === "";
      const bEmpty = bValue === null || bValue === undefined || bValue === "";

      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      if (column?.type === "number") {
        return (Number(aValue) - Number(bValue)) * factor;
      }

      if (column?.type === "boolean") {
        return (Number(Boolean(aValue)) - Number(Boolean(bValue))) * factor;
      }

      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" }) * factor;
    });
  }, [filteredRows, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  async function saveCell(rowId: string, column: string, value: RowValue) {
    const cellKey = `${rowId}:${column}`;
    setSavingCell(cellKey);
    setErrorCell(null);

    try {
      const response = await fetch(`/api/records/${table}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rowId, column, value })
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [column]: value } : row)));
    } catch {
      setErrorCell(cellKey);
      showToast("Save failed. Please try again.", "error");
    } finally {
      setSavingCell((current) => (current === cellKey ? null : current));
    }
  }

  function startEdit(rowId: string, column: string, currentValue: unknown) {
    setEditingCell(`${rowId}:${column}`);
    setEditValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
  }

  function commitEdit(rowId: string, column: RecordColumn) {
    setEditingCell(null);
    const trimmed = editValue.trim();

    if (column.type === "number") {
      void saveCell(rowId, column.key, trimmed === "" ? null : Number(trimmed));
      return;
    }

    void saveCell(rowId, column.key, trimmed === "" ? null : trimmed);
  }

  function startAddOption(rowId: string, column: RecordColumn) {
    setAddingOptionCell(`${rowId}:${column.key}`);
    setNewOptionValue("");
  }

  function commitNewOption(rowId: string, column: RecordColumn) {
    setAddingOptionCell(null);
    const trimmed = newOptionValue.trim();
    if (trimmed) {
      void saveCell(rowId, column.key, trimmed);
    }
  }

  function toggleRowSelected(rowId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = sortedRows.map((row) => String(row.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function requestDeleteSelected() {
    if (selectedIds.size === 0) return;
    setConfirmDeleteOpen(true);
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);
    setConfirmDeleteOpen(false);
    if (ids.length === 0) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/records/${table}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      const idSet = new Set(ids);
      setRows((prev) => prev.filter((row) => !idSet.has(String(row.id))));
      setSelectedIds(new Set());
      showToast(`Deleted ${ids.length} record${ids.length === 1 ? "" : "s"}.`, "success");
    } catch {
      showToast(`Failed to delete ${ids.length} record${ids.length === 1 ? "" : "s"}. Please try again.`, "error");
    } finally {
      setDeleting(false);
    }
  }

  async function resyncSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setResyncing(true);

    try {
      const response = await fetch(`/api/records/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resync", ids })
      });

      if (!response.ok) {
        throw new Error("Resync failed");
      }

      const result = await response.json();
      const resynced = typeof result.resynced === "number" ? result.resynced : 0;
      const failed = typeof result.failed === "number" ? result.failed : 0;

      showToast(
        failed > 0
          ? `Resynced ${resynced}, ${failed} failed from Zoho.`
          : `Resynced ${resynced} record${resynced === 1 ? "" : "s"} from Zoho.`,
        failed > 0 ? "error" : "success"
      );
      router.refresh();
    } catch {
      showToast(`Failed to resync ${ids.length} record${ids.length === 1 ? "" : "s"}. Please try again.`, "error");
    } finally {
      setResyncing(false);
    }
  }

  const visibleIds = sortedRows.map((row) => String(row.id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  return (
    <div>
      {isAdmin && (
        <div className="filter-banner no-print" style={{ justifyContent: "flex-start", gap: 12 }}>
          <span>{selectedIds.size} selected</span>
          <button
            type="button"
            className="button secondary"
            disabled={selectedIds.size === 0 || resyncing}
            onClick={() => void resyncSelected()}
          >
            {resyncing ? "Resyncing…" : "Resync Selected"}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={selectedIds.size === 0 || deleting}
            onClick={requestDeleteSelected}
          >
            {deleting ? "Deleting…" : "Delete Selected"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete records"
        message={`Delete ${selectedIds.size} record${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void deleteSelected()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <div className="table-panel-scroll records-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {isAdmin && (
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all visible rows"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className="sortable-header"
                onClick={() => toggleSort(column.key)}
                aria-sort={
                  sort?.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                }
              >
                {column.label}
                <span className="sort-indicator">
                  {sort?.key === column.key ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
                </span>
              </th>
            ))}
            {actionColumn && <th>{actionColumn.label}</th>}
          </tr>
          <tr>
            {isAdmin && <th className="filter-cell" />}
            {columns.map((column) => (
              <th key={column.key} className="filter-cell">
                {column.type === "boolean" ? (
                  <select
                    className="filter-input"
                    aria-label={`Filter ${column.label}`}
                    value={filters[column.key] ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, [column.key]: event.target.value }))
                    }
                  >
                    <option value="">All</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : column.type === "select" ? (
                  <select
                    className="filter-input"
                    aria-label={`Filter ${column.label}`}
                    value={filters[column.key] ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, [column.key]: event.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {column.emptyLabel && <option value={EMPTY_FILTER_VALUE}>{column.emptyLabel}</option>}
                    {selectOptionsFor(column).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="filter-input"
                    type="text"
                    placeholder="Filter…"
                    aria-label={`Filter ${column.label}`}
                    value={filters[column.key] ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, [column.key]: event.target.value }))
                    }
                  />
                )}
              </th>
            ))}
            {actionColumn && <th className="filter-cell" />}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const rowId = String(row.id);

            return (
              <tr key={rowId}>
                {isAdmin && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select row ${rowId}`}
                      checked={selectedIds.has(rowId)}
                      onChange={() => toggleRowSelected(rowId)}
                    />
                  </td>
                )}
                {columns.map((column) => {
                  const cellKey = `${rowId}:${column.key}`;
                  const value = row[column.key];

                  if (!column.editable) {
                    return <td key={column.key}>{formatValue(value)}</td>;
                  }

                  if (column.type === "boolean") {
                    return (
                      <td key={column.key}>
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          disabled={savingCell === cellKey}
                          onChange={(event) => void saveCell(rowId, column.key, event.target.checked)}
                        />
                      </td>
                    );
                  }

                  if (column.type === "select") {
                    const isCreatable = !column.options;
                    const currentValue = typeof value === "string" ? value : "";

                    if (addingOptionCell === cellKey) {
                      return (
                        <td key={column.key}>
                          <input
                            autoFocus
                            className="cell-input"
                            type="text"
                            placeholder={`New ${column.label.toLowerCase()}…`}
                            aria-label={`New ${column.label.toLowerCase()}`}
                            value={newOptionValue}
                            onChange={(event) => setNewOptionValue(event.target.value)}
                            onBlur={() => commitNewOption(rowId, column)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") commitNewOption(rowId, column);
                              if (event.key === "Escape") setAddingOptionCell(null);
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={column.key}>
                        <select
                          className="filter-input"
                          aria-label={`Edit ${column.label}`}
                          value={currentValue}
                          disabled={savingCell === cellKey}
                          onChange={(event) => {
                            const selected = event.target.value;

                            if (isCreatable && selected === ADD_NEW_OPTION_VALUE) {
                              startAddOption(rowId, column);
                              return;
                            }

                            void saveCell(rowId, column.key, selected === "" ? null : selected);
                          }}
                        >
                          <option value="">{column.emptyLabel ?? "—"}</option>
                          {selectOptionsFor(column).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          {isCreatable && <option value={ADD_NEW_OPTION_VALUE}>+ Add new…</option>}
                        </select>
                      </td>
                    );
                  }

                  if (editingCell === cellKey) {
                    return (
                      <td key={column.key}>
                        <input
                          autoFocus
                          className="cell-input"
                          type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
                          aria-label={`Edit ${column.label}`}
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onBlur={() => commitEdit(rowId, column)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitEdit(rowId, column);
                            if (event.key === "Escape") setEditingCell(null);
                          }}
                        />
                      </td>
                    );
                  }

                  return (
                    <td
                      key={column.key}
                      className={`editable-cell ${errorCell === cellKey ? "editable-cell-error" : ""}`}
                      onClick={() => startEdit(rowId, column.key, value)}
                      title={errorCell === cellKey ? "Save failed — click to retry" : "Click to edit"}
                    >
                      {savingCell === cellKey ? "Saving…" : formatValue(value)}
                    </td>
                  );
                })}
                {actionColumn && <td>{actionColumn.render(row)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {sortedRows.length === 0 && (
        <div className="empty-state">
          <p>No matching rows.</p>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
