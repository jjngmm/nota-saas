import StatusBadge from "../ui/StatusBadge";

function formatTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function AppointmentsToday({ appointments, onViewAll }) {
  const todayLabel = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <p className="dash-card-title">Citas de hoy</p>
          <p className="dash-card-sub" style={{ textTransform: "capitalize" }}>{todayLabel}</p>
        </div>
        <button className="dash-card-action" onClick={onViewAll}>Ver todas →</button>
      </div>

      {appointments.length === 0 ? (
        <div className="today-empty">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" opacity="0.25">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>No hay citas programadas para hoy</p>
        </div>
      ) : (
        <div className="today-list">
          {appointments.map((a) => (
            <div key={a.id} className="today-item">
              <div className="today-time">
                <span>{formatTime(a.start_time)}</span>
              </div>
              <div className="today-avatar">{getInitials(a.patient_name)}</div>
              <div className="today-info">
                <p className="today-patient">{a.patient_name || "—"}</p>
                <p className="today-doctor text-muted text-sm">{a.doctor_name || "—"}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}