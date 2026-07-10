"use client";

import { useMemo, useState, type ReactNode } from "react";

export type RecordColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "date";
  editable: boolean;
};

type RowValue = string | number | boolean | null;
type Row = Record<string, unknown>;

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
};

export function EditableDataTable({
  table,
  columns,
  rows: initialRows,
  actionColumn,
  presetFilter
}: EditableDataTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [errorCell, setErrorCell] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (presetFilter && !presetFilter(row)) return false;

      return columns.every((column) => {
        const filterValue = filters[column.key];
        if (!filterValue) return true;

        if (column.type === "boolean") {
          return String(Boolean(row[column.key])) === filterValue;
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

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
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
            {columns.map((column) => (
              <th key={column.key} className="filter-cell">
                {column.type === "boolean" ? (
                  <select
                    className="filter-input"
                    value={filters[column.key] ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, [column.key]: event.target.value }))
                    }
                  >
                    <option value="">All</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : (
                  <input
                    className="filter-input"
                    type="text"
                    placeholder="Filter…"
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

                  if (editingCell === cellKey) {
                    return (
                      <td key={column.key}>
                        <input
                          autoFocus
                          className="cell-input"
                          type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
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
                      title="Click to edit"
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
