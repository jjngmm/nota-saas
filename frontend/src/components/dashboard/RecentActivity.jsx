import StatusBadge from "../ui/StatusBadge";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Hoy";
  if (dateStr === yStr) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function RecentActivity({ appointments }) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <p className="dash-card-title">Actividad reciente</p>
      </div>

      {appointments.length === 0 ? (
        <p className="text-muted text-sm" style={{ padding: "12px 0" }}>Sin actividad reciente.</p>
      ) : (
        <div className="activity-list">
          {appointments.map((a) => (
            <div key={a.id} className="activity-item">
              <div className="activity-avatar">{getInitials(a.patient_name)}</div>
              <div className="activity-info">
                <p className="activity-patient">{a.patient_name || "—"}</p>
                <p className="activity-meta text-muted text-sm">
                  {a.doctor_name || "—"} · {formatDate(a.appointment_date)}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}