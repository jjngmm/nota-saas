import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function AppointmentDetailModal({
  appointment: appt,
  userRole,
  onClose,
  onEdit,
  onDelete,
}) {
  const isSecretary = userRole === "secretary" || userRole === "admin";
  const canModify =
    appt.status !== "cancelled" && appt.status !== "completed";

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Detalle de cita</h3>
            <p className="modal-subtitle">
              {formatDate(appt.appointment_date)}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            <DetailRow label="Paciente" value={appt.patient_name} />
            <DetailRow label="Médico" value={appt.doctor_name} />
            <DetailRow
              label="Horario"
              value={[formatTime(appt.start_time), formatTime(appt.end_time)]
                .filter(Boolean)
                .join(" – ")}
            />
            <DetailRow
              label="Estado"
              value={<StatusBadge status={appt.status} />}
            />
            {appt.reason && (
              <DetailRow label="Motivo" value={appt.reason} full />
            )}
            {appt.notes && (
              <DetailRow label="Notas clínicas" value={appt.notes} full />
            )}
          </div>
        </div>

        <div className="modal-footer">
          {isSecretary && canModify && (
            <Button
              variant="ghost"
              onClick={() => onDelete(appt.id)}
              className="btn--danger-ghost"
            >
              Cancelar cita
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {canModify && (
            <Button onClick={() => onEdit(appt)}>
              {isSecretary ? "Editar" : "Agregar notas"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, full }) {
  return (
    <div className={`detail-row ${full ? "detail-row--full" : ""}`}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || "—"}</span>
    </div>
  );
}