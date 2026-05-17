import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function AppointmentTable({
  appointments,
  userRole,
  onDetail,
  onEdit,
  onDelete,
}) {
  const isSecretary = userRole === "secretary" || userRole === "admin";

  return (
    <div className="table-wrapper">
      <table className="nota-table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Médico</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Estado</th>
            <th>Motivo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appt) => (
            <tr key={appt.id} className="table-row-clickable" onClick={() => onDetail(appt)}>
              <td>
                <div className="patient-cell">
                  <div className="patient-avatar">
                    {getInitials(appt.patient_name)}
                  </div>
                  <span className="patient-name">{appt.patient_name || "—"}</span>
                </div>
              </td>
              <td>
                <span className="text-sm text-muted">{appt.doctor_name || "—"}</span>
              </td>
              <td>
                <span className="date-cell">{formatDate(appt.appointment_date)}</span>
              </td>
              <td>
                <span className="time-cell font-mono text-sm">
                  {formatTime(appt.start_time)}
                </span>
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <StatusBadge status={appt.status} />
              </td>
              <td>
                <span className="notes-cell text-muted text-sm">
                  {appt.reason || appt.notes || "—"}
                </span>
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <div className="row-actions">
                  {isSecretary && appt.status !== "cancelled" && appt.status !== "completed" && (
                    <>
                      <button
                        className="action-link"
                        onClick={() => onEdit(appt)}
                      >
                        Editar
                      </button>
                      <button
                        className="action-link action-link--danger"
                        onClick={() => onDelete(appt.id)}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {!isSecretary && appt.status !== "cancelled" && (
                    <button className="action-link" onClick={() => onEdit(appt)}>
                      Notas
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}