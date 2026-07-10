"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

type SortableThProps = {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
};

export function SortableTh({ label, active, direction, onClick }: SortableThProps) {
  return (
    <th aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sortable-th" onClick={onClick}>
        {label}
        {active ? direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} />}
      </button>
    </th>
  );
}
