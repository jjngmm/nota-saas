export default function StatusBreakdown({ breakdown, total }) {
  const nonZero = breakdown.filter((s) => s.count > 0);

  // Build segments for a simple CSS bar chart
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <p className="dash-card-title">Estado de citas</p>
        <span className="dash-card-sub">{total} en total</span>
      </div>

      {total === 0 ? (
        <p className="text-muted text-sm" style={{ padding: "12px 0" }}>Sin datos aún.</p>
      ) : (
        <>
          {/* Segmented bar */}
          <div className="status-bar">
            {nonZero.map((s) => (
              <div
                key={s.key}
                className="status-bar-seg"
                style={{
                  width: `${(s.count / total) * 100}%`,
                  background: s.color,
                }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="status-legend">
            {breakdown.map((s) => (
              <div key={s.key} className={`status-legend-item ${s.count === 0 ? "status-legend-item--zero" : ""}`}>
                <span className="status-dot" style={{ background: s.color }} />
                <span className="status-legend-label">{s.label}</span>
                <span className="status-legend-count">{s.count}</span>
                <span className="status-legend-pct text-muted">
                  {total > 0 ? `${Math.round((s.count / total) * 100)}%` : "0%"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
