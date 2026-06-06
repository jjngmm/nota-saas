import { useState, useEffect } from "react";
import api from "../../services/api";
import GenderBadge from "../../components/ui/GenderBadge";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import ClinicalNoteModal from "./ClinicalNoteModal";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function PatientDetailModal({ patient, isSecretary, onClose, onEdit, onDelete }) {
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const [clinicalNotes, setClinicalNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [openNote, setOpenNote] = useState(null);
  const age = calcAge(patient.date_of_birth);

  useEffect(() => {
    fetchAppointments();
    fetchClinicalNotes();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function fetchAppointments() {
    try {
      const res = await api.get("/api/appointments");
      const patientAppts = (res.data || []).filter(
        (a) => a.patient_id === patient.id
      );
      setAppointments(patientAppts);
    } catch {
      // non-critical
    } finally {
      setLoadingAppts(false);
    }
  }

  async function fetchClinicalNotes() {
    setLoadingNotes(true);
    try {
      const res = await api.get(`/api/clinical-notes/patient/${patient.id}`);
      setClinicalNotes(res.data.data || []);
    } catch {
      // non-critical
    } finally {
      setLoadingNotes(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const TABS = [
    { id: "info", label: "Información" },
    { id: "expediente", label: `Expediente (${clinicalNotes.length})` },
    { id: "appointments", label: `Citas (${appointments.length})` },
  ];

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal modal--lg">
        {/* Header with patient avatar */}
        <div className="modal-header patient-modal-header">
          <div className="patient-profile">
            <div className="patient-avatar-xl">{getInitials(patient.full_name)}</div>
            <div>
              <h3 className="modal-title">{patient.full_name}</h3>
              <div className="patient-meta">
                <GenderBadge gender={patient.gender} />
                {age !== null && <span className="text-muted text-sm">{age} años</span>}
                {patient.blood_type && (
                  <span className="blood-type-badge">{patient.blood_type}</span>
                )}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`modal-tab ${activeTab === tab.id ? "modal-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {/* Tab: Info */}
          {activeTab === "info" && (
            <div className="detail-sections">
              <DetailSection title="Datos personales">
                <div className="detail-grid">
                  <DetailRow label="Fecha de nacimiento" value={formatDate(patient.date_of_birth)} />
                  <DetailRow label="CURP" value={patient.curp} mono />
                  <DetailRow label="Tipo de sangre" value={patient.blood_type} />
                  <DetailRow label="Género" value={<GenderBadge gender={patient.gender} />} />
                </div>
              </DetailSection>

              <DetailSection title="Contacto">
                <div className="detail-grid">
                  <DetailRow label="Teléfono" value={patient.phone} />
                  <DetailRow label="Email" value={patient.email} />
                  <DetailRow label="Dirección" value={patient.address} full />
                  <DetailRow label="Contacto de emergencia" value={patient.emergency_contact_name} />
                  <DetailRow label="Tel. emergencia" value={patient.emergency_contact_phone} />
                </div>
              </DetailSection>

              {(patient.allergies || patient.notes) && (
                <DetailSection title="Datos médicos">
                  <div className="detail-grid">
                    {patient.allergies && (
                      <DetailRow label="Alergias" value={patient.allergies} full highlight="warning" />
                    )}
                    {patient.notes && (
                      <DetailRow label="Notas clínicas" value={patient.notes} full />
                    )}
                  </div>
                </DetailSection>
              )}
            </div>
          )}

          {/* Tab: Expediente */}
          {activeTab === "expediente" && (
            <div>
              {loadingNotes ? (
                <p className="text-muted text-sm" style={{ padding: "20px 0" }}>Cargando expediente...</p>
              ) : clinicalNotes.length === 0 ? (
                <div className="empty-state" style={{ padding: "32px 0" }}>
                  <p className="empty-title">Sin notas clínicas</p>
                  <p className="empty-desc">Las notas clínicas aparecerán aquí después de cada consulta.</p>
                </div>
              ) : (
                <div className="clinical-notes-list">
                  {clinicalNotes.map((n) => (
                    <div key={n.id} className="clinical-note-card" onClick={() => setOpenNote(n)}>
                      <div className="clinical-note-card__info">
                        <span className="clinical-note-card__date">
                          {new Date(n.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        <span className="clinical-note-card__doctor">
                          {n.doctors ? `Dr. ${n.doctors.first_name} ${n.doctors.last_name}` : "—"}
                        </span>
                      </div>
                      <span className={`note-status-badge note-status-badge--${n.status}`}>
                        {n.status === "signed" ? "✓ Firmada" : "● Borrador"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Appointments */}
          {activeTab === "appointments" && (
            <div>
              {loadingAppts ? (
                <p className="text-muted text-sm" style={{ padding: "20px 0" }}>
                  Cargando citas...
                </p>
              ) : appointments.length === 0 ? (
                <div className="empty-state" style={{ padding: "32px 0" }}>
                  <p className="empty-title">Sin citas registradas</p>
                  <p className="empty-desc">Este paciente no tiene citas en el sistema.</p>
                </div>
              ) : (
                <div className="appt-history">
                  {appointments.map((a) => (
                    <div key={a.id} className="appt-history-item">
                      <div className="appt-history-date">
                        <span className="appt-day">
                          {new Date(a.appointment_date + "T00:00:00").toLocaleDateString("es-MX", {
                            day: "numeric", month: "short",
                          })}
                        </span>
                        <span className="appt-year text-muted text-sm">
                          {new Date(a.appointment_date + "T00:00:00").getFullYear()}
                        </span>
                      </div>
                      <div className="appt-history-body">
                        <div className="appt-history-top">
                          <span className="appt-doctor">{a.doctor_name || "—"}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="appt-time text-muted text-sm">
                          {formatTime(a.start_time)}
                          {a.end_time && ` – ${formatTime(a.end_time)}`}
                        </p>
                        {a.reason && <p className="appt-reason text-sm">{a.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isSecretary && (
            <Button
              variant="ghost"
              onClick={() => onDelete(patient.id)}
              className="btn--danger-ghost"
            >
              Eliminar
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {isSecretary && (
            <Button onClick={() => onEdit(patient)}>Editar paciente</Button>
          )}
        </div>
      </div>

      {openNote && (
        <ClinicalNoteModal
          note={openNote}
          onClose={() => setOpenNote(null)}
          onSaved={(updated) => {
            setClinicalNotes((prev) => prev.map((n) => n.id === updated.id ? updated : n));
            setOpenNote(updated);
          }}
        />
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="detail-section">
      <p className="detail-section-title">{title}</p>
      {children}
    </div>
  );
}

function DetailRow({ label, value, full, mono, highlight }) {
  const highlightClass = highlight === "warning" ? "detail-value--warning" : "";
  return (
    <div className={`detail-row ${full ? "detail-row--full" : ""}`}>
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? "font-mono text-sm" : ""} ${highlightClass}`}>
        {value || "—"}
      </span>
    </div>
  );
}
