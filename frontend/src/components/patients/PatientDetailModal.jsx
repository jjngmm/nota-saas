import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import GenderBadge from "../../components/ui/GenderBadge";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import ClinicalNoteModal from "./ClinicalNoteModal";

const ID_TYPES = ['INE / IFE', 'Pasaporte', 'Cédula profesional', 'Acta de nacimiento', 'Cartilla militar', 'Otro'];

const CFDI_OPTIONS = [
  { value: 'D01', label: 'D01 – Honorarios médicos, dentales y gastos hospitalarios' },
  { value: 'D02', label: 'D02 – Gastos médicos por incapacidad o discapacidad' },
  { value: 'G01', label: 'G01 – Adquisición de bienes' },
  { value: 'G03', label: 'G03 – Gastos en general' },
  { value: 'S01', label: 'S01 – Sin efectos fiscales' },
  { value: 'CP01', label: 'CP01 – Pagos' },
];

const REGIMEN_OPTIONS = [
  { value: '605', label: '605 – Sueldos y Salarios e Ingresos Asimilados' },
  { value: '612', label: '612 – Personas Físicas con Actividades Empresariales' },
  { value: '616', label: '616 – Sin obligaciones fiscales' },
  { value: '621', label: '621 – Incorporación Fiscal' },
  { value: '625', label: '625 – Actividades Agrícolas, Ganaderas, Silvícolas' },
  { value: '626', label: '626 – Régimen Simplificado de Confianza (RESICO)' },
];

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

export default function PatientDetailModal({ patient: rawPatient, isSecretary, onClose, onEdit, onDelete }) {
  const patient = {
    ...rawPatient,
    full_name: rawPatient.full_name || [rawPatient.first_name, rawPatient.last_name, rawPatient.last_name_maternal].filter(Boolean).join(' '),
  };
  const [pat, setPat] = useState(patient); // local mutable copy
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const navigate = useNavigate();
  const [clinicalNotes, setClinicalNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [openNote, setOpenNote] = useState(null);
  const age = calcAge(pat.birth_date || pat.date_of_birth);

  // docs pending indicator
  const docsPending = !pat.consent_signed || !pat.id_document_url;

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
    { id: "info",         label: "Información" },
    { id: "documentos",   label: docsPending ? "Documentos ⚠" : "Documentos" },
    { id: "expediente",   label: `Expediente (${clinicalNotes.length})` },
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
          <button
            className="pp-edit-btn"
            style={{marginRight:'0.5rem'}}
            onClick={() => { onClose(); navigate(`/patients/${pat.id}`); }}
          >
            📋 Ver expediente completo →
          </button>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Alerta de alergias ── */}
        <ModalAllergyAlert patient={pat} />

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
                  <DetailRow label="Nombre(s)" value={patient.first_name} />
                  <DetailRow label="Apellido paterno" value={patient.last_name} />
                  <DetailRow label="Apellido materno" value={patient.last_name_maternal} />
                  <DetailRow label="Fecha de nacimiento" value={formatDate(patient.birth_date || patient.date_of_birth)} />
                  <DetailRow label="Edad" value={age !== null ? `${age} años` : null} />
                  <DetailRow label="Sexo" value={<GenderBadge gender={patient.gender} />} />
                  <DetailRow label="Tipo de sangre" value={patient.blood_type} />
                  <DetailRow label="CURP" value={patient.curp} mono />
                  <DetailRow label="Estado civil" value={patient.estado_civil} />
                  <DetailRow label="Ocupación" value={patient.ocupacion} />
                </div>
              </DetailSection>

              {!patient.is_minor ? (
                <DetailSection title="Contacto">
                  <div className="detail-grid">
                    <DetailRow label="Teléfono" value={patient.phone} />
                    <DetailRow label="Email" value={patient.email} />
                    <DetailRow label="Calle y número" value={patient.address} full />
                    <DetailRow label="Colonia" value={patient.colonia} />
                    <DetailRow label="Ciudad" value={patient.ciudad} />
                    <DetailRow label="Estado" value={patient.estado} />
                    <DetailRow label="C.P." value={patient.codigo_postal} />
                  </div>
                </DetailSection>
              ) : (
                <DetailSection title="Acompañante (tutor legal)">
                  <div className="detail-grid">
                    <DetailRow label="Nombre" value={[patient.companion_first_name, patient.companion_last_name, patient.companion_last_name_maternal].filter(Boolean).join(' ')} full />
                    <DetailRow label="Relación" value={patient.companion_relationship} />
                    <DetailRow label="Teléfono" value={patient.companion_phone} />
                    <DetailRow label="Email" value={patient.companion_email} />
                  </div>
                </DetailSection>
              )}

              {(patient.allergies || patient.notes) && (
                <DetailSection title="Datos médicos">
                  <div className="detail-grid">
                    {patient.allergies && <DetailRow label="Alergias" value={patient.allergies} full highlight="warning" />}
                    {patient.notes && <DetailRow label="Antecedentes / Notas" value={patient.notes} full />}
                  </div>
                </DetailSection>
              )}

              {patient.privacy_accepted && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ color: 'var(--success)' }}>✓</span>
                  Aviso de privacidad aceptado{patient.privacy_accepted_at ? ` el ${formatDate(patient.privacy_accepted_at?.split('T')[0])}` : ''}
                </div>
              )}
            </div>
          )}

          {/* Tab: Documentos */}
          {activeTab === "documentos" && (
            <DocumentosTab
              patient={pat}
              onUpdate={setPat}
            />
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

// ══════════════════════════════════════════════════════════════
// TAB: DOCUMENTOS
// ══════════════════════════════════════════════════════════════
function DocumentosTab({ patient, onUpdate }) {
  const fileRef = useRef(null);

  // ── Consentimiento ──
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [witness, setWitness] = useState('');
  const [savingConsent, setSavingConsent] = useState(false);

  // ── ID ──
  const [idType, setIdType] = useState(patient.id_document_type || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ── Facturación ──
  const [billing, setBilling] = useState({
    requires_invoice: !!patient.requires_invoice,
    rfc: patient.rfc || '',
    razon_social: patient.razon_social || '',
    uso_cfdi: patient.uso_cfdi || '',
    regimen_fiscal: patient.regimen_fiscal || '',
    billing_email: patient.billing_email || '',
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);

  async function handleSignConsent() {
    setSavingConsent(true);
    try {
      const res = await api.patch(`/api/patients/${patient.id}/consent`, { witness });
      onUpdate(prev => ({ ...prev, ...res.data }));
      setShowConsentModal(false);
      setWitness('');
    } catch { /* non-critical */ }
    finally { setSavingConsent(false); }
  }

  async function handleUploadId(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setUploadError('El archivo no debe superar 8 MB'); return; }
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', idType);
      const res = await api.post(`/api/patients/${patient.id}/id-document`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdate(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Error al subir el archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSaveBilling() {
    setSavingBilling(true);
    try {
      const res = await api.patch(`/api/patients/${patient.id}/billing`, billing);
      onUpdate(prev => ({ ...prev, ...res.data }));
      setBillingSaved(true);
      setTimeout(() => setBillingSaved(false), 2500);
    } catch { /* */ }
    finally { setSavingBilling(false); }
  }

  return (
    <div className="doc-tab">

      {/* ── Consentimiento informado ── */}
      <div className="doc-section">
        <div className="doc-section__header">
          <div className="doc-section__title">
            <span>📄</span> Consentimiento informado
          </div>
          {patient.consent_signed
            ? <span className="doc-badge doc-badge--ok">✓ Firmado</span>
            : <span className="doc-badge doc-badge--pending">Pendiente</span>
          }
        </div>
        <div className="doc-section__body">
          {patient.consent_signed ? (
            <div className="doc-info-row">
              <span className="doc-info-label">Fecha de firma</span>
              <span className="doc-info-value">
                {new Date(patient.consent_signed_at).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {patient.consent_witness && (
                <>
                  <span className="doc-info-label">Testigo / Personal</span>
                  <span className="doc-info-value">{patient.consent_witness}</span>
                </>
              )}
            </div>
          ) : (
            <p className="doc-hint">
              El paciente debe leer y firmar el consentimiento informado antes de su primera consulta.
              Registra la firma aquí una vez que la hayas obtenido.
            </p>
          )}
          {!patient.consent_signed && (
            <Button onClick={() => setShowConsentModal(true)} style={{ marginTop: '0.75rem' }}>
              ✍ Registrar firma de consentimiento
            </Button>
          )}
        </div>
      </div>

      {/* ── Identificación oficial ── */}
      <div className="doc-section">
        <div className="doc-section__header">
          <div className="doc-section__title">
            <span>🪪</span> Identificación oficial
          </div>
          {patient.id_document_url
            ? <span className="doc-badge doc-badge--ok">✓ Cargada</span>
            : <span className="doc-badge doc-badge--pending">Pendiente</span>
          }
        </div>
        <div className="doc-section__body">
          {patient.id_document_url ? (
            <div className="doc-file-row">
              <div className="doc-file-icon">📎</div>
              <div className="doc-file-info">
                <span className="doc-file-name">{patient.id_document_name || 'Identificación'}</span>
                {patient.id_document_type && (
                  <span className="doc-file-type">{patient.id_document_type}</span>
                )}
              </div>
              <a href={patient.id_document_url} target="_blank" rel="noreferrer" className="doc-file-link">
                Ver documento
              </a>
            </div>
          ) : (
            <p className="doc-hint">Sube una foto o PDF de la identificación oficial del paciente.</p>
          )}

          <div className="doc-upload-row">
            <div className="config-select-wrap" style={{ flex: '0 0 200px' }}>
              <select
                className="config-select"
                value={idType}
                onChange={e => setIdType(e.target.value)}
              >
                <option value="">Tipo de documento...</option>
                {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button
              className="doc-upload-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Subiendo...' : patient.id_document_url ? '↑ Reemplazar' : '↑ Subir documento'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={handleUploadId}
            />
          </div>
          {uploadError && <p className="doc-error">{uploadError}</p>}
        </div>
      </div>

      {/* ── Datos de facturación ── */}
      <div className="doc-section">
        <div className="doc-section__header">
          <div className="doc-section__title">
            <span>🧾</span> Datos de facturación
          </div>
          {patient.requires_invoice
            ? <span className="doc-badge doc-badge--ok">✓ Registrados</span>
            : <span className="doc-badge doc-badge--neutral">No requiere</span>
          }
        </div>
        <div className="doc-section__body">
          <label className="doc-toggle-row">
            <input
              type="checkbox"
              checked={billing.requires_invoice}
              onChange={e => setBilling(p => ({ ...p, requires_invoice: e.target.checked }))}
            />
            <span>El paciente requiere factura electrónica (CFDI)</span>
          </label>

          {billing.requires_invoice && (
            <div className="doc-billing-grid">
              <div className="config-field">
                <label className="config-label">RFC *</label>
                <input className="config-input" value={billing.rfc}
                  onChange={e => setBilling(p => ({ ...p, rfc: e.target.value.toUpperCase() }))}
                  placeholder="XAXX010101000" maxLength={13} />
              </div>
              <div className="config-field">
                <label className="config-label">Email para factura</label>
                <input className="config-input" type="email" value={billing.billing_email}
                  onChange={e => setBilling(p => ({ ...p, billing_email: e.target.value }))}
                  placeholder="factura@ejemplo.com" />
              </div>
              <div className="config-field doc-field--full">
                <label className="config-label">Razón social *</label>
                <input className="config-input" value={billing.razon_social}
                  onChange={e => setBilling(p => ({ ...p, razon_social: e.target.value.toUpperCase() }))}
                  placeholder="NOMBRE O RAZÓN SOCIAL TAL COMO APARECE EN EL SAT" />
              </div>
              <div className="config-field">
                <label className="config-label">Uso CFDI</label>
                <div className="config-select-wrap">
                  <select className="config-select" value={billing.uso_cfdi}
                    onChange={e => setBilling(p => ({ ...p, uso_cfdi: e.target.value }))}>
                    <option value="">Selecciona...</option>
                    {CFDI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="config-field">
                <label className="config-label">Régimen fiscal</label>
                <div className="config-select-wrap">
                  <select className="config-select" value={billing.regimen_fiscal}
                    onChange={e => setBilling(p => ({ ...p, regimen_fiscal: e.target.value }))}>
                    <option value="">Selecciona...</option>
                    {REGIMEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <Button onClick={handleSaveBilling} disabled={savingBilling}>
              {savingBilling ? 'Guardando...' : 'Guardar datos de facturación'}
            </Button>
            {billingSaved && <span style={{ fontSize: '0.8rem', color: 'var(--forest-mid)' }}>✓ Guardado</span>}
          </div>
        </div>
      </div>

      {/* ── Modal consentimiento ── */}
      {showConsentModal && (
        <div className="exp-modal-overlay" onClick={() => setShowConsentModal(false)}>
          <div className="exp-modal" onClick={e => e.stopPropagation()}>
            <div className="exp-modal__title">Registrar consentimiento informado</div>
            <p className="exp-modal__body">
              Confirma que el paciente <strong>{patient.full_name || `${patient.first_name} ${patient.last_name}`}</strong> leyó
              y firmó físicamente el consentimiento informado. Esta acción quedará registrada con fecha y hora.
            </p>
            <div className="config-field" style={{ marginBottom: '1.25rem' }}>
              <label className="config-label">Nombre del personal que recibió la firma (opcional)</label>
              <input
                className="config-input"
                value={witness}
                onChange={e => setWitness(e.target.value)}
                placeholder="Ej. Dra. García / Recepción"
                autoFocus
              />
            </div>
            <div className="exp-modal__actions">
              <Button variant="ghost" onClick={() => setShowConsentModal(false)}>Cancelar</Button>
              <Button onClick={handleSignConsent} disabled={savingConsent}>
                {savingConsent ? 'Registrando...' : '✍ Confirmar firma'}
              </Button>
            </div>
          </div>
        </div>
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

// ── Alerta de alergias en modal ──────────────────────────────
function ModalAllergyAlert({ patient }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !patient?.allergies) return null;
  return (
    <div className="pp-allergy-alert pp-allergy-alert--modal" role="alert">
      <div className="pp-allergy-alert__icon">⚠</div>
      <div className="pp-allergy-alert__body">
        <span className="pp-allergy-alert__title">ALERTA DE ALERGIA</span>
        <span className="pp-allergy-alert__text">{patient.allergies}</span>
      </div>
      <button className="pp-allergy-alert__dismiss" onClick={() => setDismissed(true)}
        title="Cerrar alerta">✕</button>
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
