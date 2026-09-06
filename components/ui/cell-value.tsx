/**
 * A table cell's value, or a dash when the record doesn't carry one.
 *
 * The dash is marked (`cell-empty`) rather than written as bare text so the
 * mobile card layouts can drop the line entirely: a column needs a
 * placeholder to keep its shape, a card doesn't.
 */
export function CellValue({ value }: { value: string | null | undefined }) {
  if (value === null || value === undefined || value === "") {
    return <span className="cell-empty">—</span>;
  }

  return <>{value}</>;
}
