// Route-level loading state. A shaped skeleton rather than a lone spinner:
// the header, stat row and table blocks appear where the real content will,
// so a slow load doesn't collapse the layout and then snap it back.
export function PageSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className="content" role="status" aria-label="Loading">
      <span className="visually-hidden">Loading…</span>

      <div style={{ marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 220, height: 30, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: "min(460px, 70%)", height: 15 }} />
      </div>

      <div className="metric-grid" style={{ marginBottom: 20 }}>
        {Array.from({ length: stats }).map((_, index) => (
          <div key={index} className="skeleton" style={{ height: 96 }} />
        ))}
      </div>

      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );
}
