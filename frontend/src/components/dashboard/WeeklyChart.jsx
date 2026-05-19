export default function WeeklyChart({ weeklyData }) {
  const max = Math.max(...weeklyData.map((d) => d.count), 1);

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <p className="dash-card-title">Citas — últimos 7 días</p>
          <p className="dash-card-sub">
            Total:{" "}
            <strong>{weeklyData.reduce((s, d) => s + d.count, 0)}</strong> citas
          </p>
        </div>
      </div>

      <div className="weekly-chart">
        {weeklyData.map((day) => {
          const pct = max > 0 ? (day.count / max) * 100 : 0;
          return (
            <div key={day.date} className="weekly-col">
              <div className="weekly-bar-wrap">
                <div
                  className={`weekly-bar ${day.isToday ? "weekly-bar--today" : ""}`}
                  style={{ height: `${Math.max(pct, day.count > 0 ? 6 : 0)}%` }}
                />
                {day.count > 0 && (
                  <span className="weekly-count">{day.count}</span>
                )}
              </div>
              <span className={`weekly-label ${day.isToday ? "weekly-label--today" : ""}`}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
