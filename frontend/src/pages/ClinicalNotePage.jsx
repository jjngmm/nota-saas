import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import '../styles/clinical_notes.css';

// ── Constantes ────────────────────────────────────────────────
const SOAP_FIELDS = [
  { key: 'subjective',  label: 'Subjetivo',  hint: 'S', placeholder: 'Motivo de consulta, síntomas referidos por el paciente, evolución...' },
  { key: 'objective',   label: 'Objetivo',   hint: 'O', placeholder: 'Exploración física, signos, hallazgos...' },
  { key: 'assessment',  label: 'Análisis',   hint: 'A', placeholder: 'Interpretación clínica, diagnóstico diferencial...' },
  { key: 'plan',        label: 'Plan',       hint: 'P', placeholder: 'Indicaciones, seguimiento, referencias...' },
];

const VITAL_FIELDS = [
  { key: 'peso_kg',         label: 'Peso', unit: 'kg',    type: 'number', step: '0.1' },
  { key: 'talla_cm',        label: 'Talla', unit: 'cm',   type: 'number', step: '0.5' },
  { key: 'ta_sistolica',    label: 'TA sistólica', unit: 'mmHg', type: 'number' },
  { key: 'ta_diastolica',   label: 'TA diastólica', unit: 'mmHg', type: 'number' },
  { key: 'fc',              label: 'FC', unit: 'lpm',     type: 'number' },
  { key: 'fr',              label: 'FR', unit: 'rpm',     type: 'number' },
  { key: 'temperatura',     label: 'Temperatura', unit: '°C', type: 'number', step: '0.1' },
  { key: 'spo2',            label: 'SpO₂', unit: '%',     type: 'number' },
];

const EMPTY_RX = { medicamento: '', presentacion: '', dosis: '', frecuencia: '', duracion: '', indicaciones: '' };

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function fmt(date) {
  if (!date) return '';
  return new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ══════════════════════════════════════════════════════════════
export default function ClinicalNotePage() {
  const { appointment_id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [note, setNote]               = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saveState, setSaveState]     = useState('idle'); // idle | saving | saved | error
  const [creating, setCreating]       = useState(false);
  const [signing, setSigning]         = useState(false);
  const [confirmSign, setConfirmSign] = useState(false);

  const autosaveTimer = useRef(null);
  const latestNote    = useRef(null);

  useEffect(() => {
    loadData();
    return () => clearTimeout(autosaveTimer.current);
  }, [appointment_id]);

  async function loadData() {
    setLoading(true);
    try {
      const [noteRes, apptRes] = await Promise.all([
        api.get(`/api/clinical-notes?appointment_id=${appointment_id}`),
        api.get(`/api/appointments/${appointment_id}`),
      ]);
      setNote(noteRes.data.data);
      setAppointment(apptRes.data.appointment || apptRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createNote() {
    if (!appointment) return;
    setCreating(true);
    try {
      const res = await api.post('/api/clinical-notes', {
        appointment_id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
      });
      setNote(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  // Autosave: schedules a save 1.5s after last change
  const scheduleAutosave = useCallback((updatedNote) => {
    latestNote.current = updatedNote;
    clearTimeout(autosaveTimer.current);
    setSaveState('idle');
    autosaveTimer.current = setTimeout(async () => {
      if (!latestNote.current || latestNote.current.status === 'signed') return;
      setSaveState('saving');
      try {
        const n = latestNote.current;
        const res = await api.put(`/api/clinical-notes/${n.id}`, {
          subjective: n.subjective, objective: n.objective,
          assessment: n.assessment, plan: n.plan,
          vital_signs: n.vital_signs, diagnosis: n.diagnosis,
          diagnosis_cie10: n.diagnosis_cie10, prescriptions: n.prescriptions,
        });
        setNote(res.data.data);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        setSaveState('error');
      }
    }, 1500);
  }, []);

  function updateNote(patch) {
    setNote(prev => {
      const updated = { ...prev, ...patch };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function updateVital(key, val) {
    setNote(prev => {
      const updated = { ...prev, vital_signs: { ...(prev.vital_signs || {}), [key]: val } };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function updateRx(idx, field, val) {
    setNote(prev => {
      const rxs = [...(prev.prescriptions || [])];
      rxs[idx] = { ...rxs[idx], [field]: val };
      const updated = { ...prev, prescriptions: rxs };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function addRx() {
    setNote(prev => {
      const updated = { ...prev, prescriptions: [...(prev.prescriptions || []), { ...EMPTY_RX }] };
      scheduleAutosave(updated);
      return updated;
    });
  }

  function removeRx(idx) {
    setNote(prev => {
      const rxs = (prev.prescriptions || []).filter((_, i) => i !== idx);
      const updated = { ...prev, prescriptions: rxs };
      scheduleAutosave(updated);
      return updated;
    });
  }

  async function handleSign() {
    setSigning(true);
    try {
      // Save first, then sign
      await api.put(`/api/clinical-notes/${note.id}`, {
        subjective: note.subjective, objective: note.objective,
        assessment: note.assessment, plan: note.plan,
        vital_signs: note.vital_signs, diagnosis: note.diagnosis,
        diagnosis_cie10: note.diagnosis_cie10, prescriptions: note.prescriptions,
      });
      const res = await api.post(`/api/clinical-notes/${note.id}/sign`);
      setNote(res.data.data);
      setSaveState('idle');
      setConfirmSign(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSigning(false);
    }
  }

  const isSigned   = note?.status === 'signed';
  const canSign    = ['admin', 'doctor'].includes(user?.role) && !isSigned;
  const patient    = appointment?.patients || appointment?.patient || {};
  const doctor     = appointment?.doctors  || appointment?.doctor  || {};
  const age        = calcAge(patient.date_of_birth);

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="nota-layout">
        <Sidebar />
        <div className="nota-main">
          <Navbar title="Expediente clínico" />
          <div className="nota-content">
            <p style={{ color: 'var(--ink-40)', padding: '3rem 0' }}>Cargando expediente...</p>
          </div>
        </div>
      </div>
    );
  }

  const navbarTitle = patient.first_name
    ? `${patient.first_name} ${patient.last_name || ''}`
    : 'Expediente clínico';

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar
          title={navbarTitle}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <SaveIndicator state={saveState} />
              {!isSigned && note && canSign && (
                <Button onClick={() => setConfirmSign(true)} disabled={signing}>
                  ✍ Firmar nota
                </Button>
              )}
              {isSigned && (
                <span className="note-status-badge note-status-badge--signed">✓ Firmada</span>
              )}
            </div>
          }
        />

        <div className="nota-content exp-content">

          {/* ── Info strip ── */}
          <div className="exp-info-strip">
            <div className="exp-info-strip__section">
              <span className="exp-info-strip__label">Paciente</span>
              <span className="exp-info-strip__value">
                {patient.first_name} {patient.last_name}
                {age !== null && <span className="exp-info-strip__age">{age} años</span>}
              </span>
            </div>
            {patient.date_of_birth && (
              <div className="exp-info-strip__section">
                <span className="exp-info-strip__label">Nacimiento</span>
                <span className="exp-info-strip__value">{fmt(patient.date_of_birth)}</span>
              </div>
            )}
            {patient.blood_type && (
              <div className="exp-info-strip__section">
                <span className="exp-info-strip__label">Tipo sanguíneo</span>
                <span className="exp-info-strip__value exp-blood">{patient.blood_type}</span>
              </div>
            )}
            <div className="exp-info-strip__section">
              <span className="exp-info-strip__label">Fecha</span>
              <span className="exp-info-strip__value">
                {fmt(appointment?.appointment_date)}
                {appointment?.start_time && ` · ${appointment.start_time.slice(0,5)}`}
              </span>
            </div>
            <div className="exp-info-strip__section">
              <span className="exp-info-strip__label">Médico</span>
              <span className="exp-info-strip__value">{doctor.first_name} {doctor.last_name}</span>
            </div>
            <div className="exp-info-strip__section">
              <span className="exp-info-strip__label">Tipo</span>
              <span className="exp-info-strip__value">
                {appointment?.visit_type === 'primera_vez' ? 'Primera vez' :
                 appointment?.visit_type === 'subsecuente' ? 'Subsecuente' :
                 appointment?.visit_type || '—'}
              </span>
            </div>
          </div>

          {/* ── Alergias ── */}
          {patient.allergies && (
            <div className="exp-allergy-bar">
              <span className="exp-allergy-bar__icon">⚠</span>
              <span className="exp-allergy-bar__label">Alergias:</span>
              <span>{patient.allergies}</span>
            </div>
          )}

          {/* ── Sin nota → crear ── */}
          {!note ? (
            <div className="exp-empty">
              <div className="exp-empty__icon">📋</div>
              <p className="exp-empty__title">Sin nota clínica</p>
              <p className="exp-empty__desc">No existe una nota clínica para esta consulta.</p>
              <Button onClick={createNote} disabled={creating} style={{ marginTop: '1.25rem' }}>
                {creating ? 'Creando...' : '+ Crear nota clínica'}
              </Button>
            </div>
          ) : (
            <div className="exp-body">

              {/* ── Signos vitales ── */}
              <ExpSection title="Signos vitales" icon="🩺">
                <div className="exp-vitals-grid">
                  {VITAL_FIELDS.map(f => (
                    <div key={f.key} className="exp-vital-field">
                      <label className="exp-vital-field__label">
                        {f.label}
                        <span className="exp-vital-field__unit">{f.unit}</span>
                      </label>
                      <input
                        type={f.type}
                        step={f.step || '1'}
                        className="exp-vital-input"
                        value={(note.vital_signs || {})[f.key] || ''}
                        onChange={e => updateVital(f.key, e.target.value)}
                        readOnly={isSigned}
                        placeholder="—"
                      />
                    </div>
                  ))}
                  {/* IMC calculado */}
                  {(note.vital_signs?.peso_kg && note.vital_signs?.talla_cm) && (
                    <div className="exp-vital-field exp-vital-field--imc">
                      <label className="exp-vital-field__label">IMC<span className="exp-vital-field__unit">kg/m²</span></label>
                      <div className="exp-vital-imc">
                        {(note.vital_signs.peso_kg / Math.pow(note.vital_signs.talla_cm / 100, 2)).toFixed(1)}
                      </div>
                    </div>
                  )}
                </div>
              </ExpSection>

              {/* ── SOAP ── */}
              <ExpSection title="Nota SOAP" icon="📝">
                <div className="exp-soap-grid">
                  {SOAP_FIELDS.map(({ key, label, hint, placeholder }) => (
                    <div key={key} className="soap-section">
                      <div className="soap-section__label">
                        {label} <span>{hint}</span>
                      </div>
                      <textarea
                        value={note[key] || ''}
                        onChange={e => updateNote({ [key]: e.target.value })}
                        readOnly={isSigned}
                        placeholder={isSigned ? '' : placeholder}
                        rows={5}
                      />
                    </div>
                  ))}
                </div>
              </ExpSection>

              {/* ── Diagnóstico ── */}
              <ExpSection title="Diagnóstico" icon="🔬">
                <div className="exp-dx-row">
                  <div className="exp-dx-main">
                    <label className="exp-field-label">Diagnóstico principal</label>
                    <input
                      className="exp-text-input"
                      value={note.diagnosis || ''}
                      onChange={e => updateNote({ diagnosis: e.target.value })}
                      readOnly={isSigned}
                      placeholder="Descripción del diagnóstico..."
                    />
                  </div>
                  <div className="exp-dx-cie">
                    <label className="exp-field-label">Clave CIE-10</label>
                    <input
                      className="exp-text-input exp-text-input--mono"
                      value={note.diagnosis_cie10 || ''}
                      onChange={e => updateNote({ diagnosis_cie10: e.target.value.toUpperCase() })}
                      readOnly={isSigned}
                      placeholder="Ej. J06.9"
                      maxLength={8}
                    />
                  </div>
                </div>
              </ExpSection>

              {/* ── Prescripciones ── */}
              <ExpSection
                title="Prescripciones"
                icon="💊"
                action={!isSigned && (
                  <button className="exp-add-rx-btn" onClick={addRx}>+ Agregar medicamento</button>
                )}
              >
                {(!note.prescriptions || note.prescriptions.length === 0) ? (
                  <p className="exp-empty-inline">
                    {isSigned ? 'Sin prescripciones registradas.' : 'Sin medicamentos. Usa el botón para agregar.'}
                  </p>
                ) : (
                  <div className="exp-rx-list">
                    {(note.prescriptions || []).map((rx, i) => (
                      <RxCard
                        key={i}
                        rx={rx}
                        index={i}
                        isSigned={isSigned}
                        onChange={(field, val) => updateRx(i, field, val)}
                        onRemove={() => removeRx(i)}
                      />
                    ))}
                  </div>
                )}
              </ExpSection>

              {/* ── Transcripción (si existe) ── */}
              {note.raw_transcript && (
                <ExpSection title="Transcripción de consulta" icon="🎙">
                  <div className="transcript-section__text">{note.raw_transcript}</div>
                </ExpSection>
              )}

            </div>
          )}
        </div>
      </div>

      {/* ── Modal confirmación firma ── */}
      {confirmSign && (
        <div className="exp-modal-overlay" onClick={() => setConfirmSign(false)}>
          <div className="exp-modal" onClick={e => e.stopPropagation()}>
            <div className="exp-modal__title">Firmar nota clínica</div>
            <p className="exp-modal__body">
              Al firmar, la nota quedará bloqueada y no podrá modificarse. Esta acción es irreversible conforme a la NOM-024.
            </p>
            <div className="exp-modal__actions">
              <Button variant="ghost" onClick={() => setConfirmSign(false)}>Cancelar</Button>
              <Button onClick={handleSign} disabled={signing}>
                {signing ? 'Firmando...' : '✍ Confirmar firma'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────

function ExpSection({ title, icon, action, children }) {
  return (
    <div className="exp-section">
      <div className="exp-section__header">
        <div className="exp-section__title">
          <span className="exp-section__icon">{icon}</span>
          {title}
        </div>
        {action}
      </div>
      <div className="exp-section__body">{children}</div>
    </div>
  );
}

function RxCard({ rx, index, isSigned, onChange, onRemove }) {
  return (
    <div className="exp-rx-card">
      <div className="exp-rx-card__num">{index + 1}</div>
      <div className="exp-rx-card__fields">
        <div className="exp-rx-row">
          <div className="exp-rx-field exp-rx-field--wide">
            <label>Medicamento</label>
            <input
              className="exp-text-input"
              value={rx.medicamento || ''}
              onChange={e => onChange('medicamento', e.target.value)}
              readOnly={isSigned}
              placeholder="Nombre del medicamento..."
            />
          </div>
          <div className="exp-rx-field">
            <label>Presentación</label>
            <input
              className="exp-text-input"
              value={rx.presentacion || ''}
              onChange={e => onChange('presentacion', e.target.value)}
              readOnly={isSigned}
              placeholder="Tabletas, cápsulas..."
            />
          </div>
          <div className="exp-rx-field">
            <label>Dosis</label>
            <input
              className="exp-text-input"
              value={rx.dosis || ''}
              onChange={e => onChange('dosis', e.target.value)}
              readOnly={isSigned}
              placeholder="500 mg"
            />
          </div>
        </div>
        <div className="exp-rx-row">
          <div className="exp-rx-field">
            <label>Frecuencia</label>
            <input
              className="exp-text-input"
              value={rx.frecuencia || ''}
              onChange={e => onChange('frecuencia', e.target.value)}
              readOnly={isSigned}
              placeholder="Cada 8 horas"
            />
          </div>
          <div className="exp-rx-field">
            <label>Duración</label>
            <input
              className="exp-text-input"
              value={rx.duracion || ''}
              onChange={e => onChange('duracion', e.target.value)}
              readOnly={isSigned}
              placeholder="7 días"
            />
          </div>
          <div className="exp-rx-field exp-rx-field--wide">
            <label>Indicaciones</label>
            <input
              className="exp-text-input"
              value={rx.indicaciones || ''}
              onChange={e => onChange('indicaciones', e.target.value)}
              readOnly={isSigned}
              placeholder="Tomar con alimentos..."
            />
          </div>
        </div>
      </div>
      {!isSigned && (
        <button className="exp-rx-card__remove" onClick={onRemove} title="Eliminar">✕</button>
      )}
    </div>
  );
}

function SaveIndicator({ state }) {
  if (state === 'idle') return null;
  const map = {
    saving: { text: 'Guardando...', cls: 'exp-save--saving' },
    saved:  { text: '✓ Guardado',   cls: 'exp-save--saved'  },
    error:  { text: '✕ Error al guardar', cls: 'exp-save--error' },
  };
  const { text, cls } = map[state] || {};
  return <span className={`exp-save ${cls}`}>{text}</span>;
}
