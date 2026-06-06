import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Button from '../components/ui/Button';
import '../styles/clinical_notes.css';

const SOAP_FIELDS = [
  { key: 'subjective', label: 'Subjetivo', hint: 'S' },
  { key: 'objective', label: 'Objetivo', hint: 'O' },
  { key: 'assessment', label: 'Análisis', hint: 'A' },
  { key: 'plan', label: 'Plan', hint: 'P' },
];

export default function ClinicalNotePage() {
  const { appointment_id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [note, setNote] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, [appointment_id]);

  async function loadData() {
    setLoading(true);
    try {
      const [noteRes, apptRes] = await Promise.all([
        api.get(`/api/clinical-notes?appointment_id=${appointment_id}`),
        api.get(`/api/appointments/${appointment_id}`),
      ]);
      setNote(noteRes.data.data);
      setAppointment(apptRes.data);
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

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put(`/api/clinical-notes/${note.id}`, {
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
      });
      setNote(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSign() {
    setSigning(true);
    try {
      const res = await api.post(`/api/clinical-notes/${note.id}/sign`);
      setNote(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSigning(false);
    }
  }

  const isSigned = note?.status === 'signed';

  if (loading) {
    return (
      <div className="clinical-note-page">
        <p className="text-muted text-sm">Cargando nota clínica...</p>
      </div>
    );
  }

  return (
    <div className="clinical-note-page">
      <button className="clinical-note-page__back" onClick={() => navigate(-1)}>
        ← Regresar
      </button>

      <div className="clinical-note-page__header">
        <h1 className="clinical-note-page__title">Nota Clínica</h1>
        {appointment && (
          <div className="clinical-note-page__meta">
            <span>Cita: {appointment.appointment_date}</span>
            {appointment.patients && (
              <span>Paciente: {appointment.patients.first_name} {appointment.patients.last_name}</span>
            )}
            {note && (
              <span className={`note-status-badge note-status-badge--${note.status}`}>
                {note.status === 'signed' ? '✓ Firmada' : '● Borrador'}
              </span>
            )}
          </div>
        )}
      </div>

      {!note ? (
        <div className="empty-state" style={{ padding: '48px 0' }}>
          <p className="empty-title">Sin nota clínica</p>
          <p className="empty-desc">No existe una nota clínica para esta cita.</p>
          <Button onClick={createNote} disabled={creating} style={{ marginTop: '1rem' }}>
            {creating ? 'Creando...' : 'Crear nota clínica'}
          </Button>
        </div>
      ) : (
        <div className="clinical-note-page__body">
          {SOAP_FIELDS.map(({ key, label, hint }) => (
            <div key={key} className="soap-section">
              <div className="soap-section__label">
                {label} <span>{hint}</span>
              </div>
              <textarea
                value={note[key] || ''}
                onChange={(e) => setNote((prev) => ({ ...prev, [key]: e.target.value }))}
                readOnly={isSigned}
                placeholder={isSigned ? '' : `Ingresa ${label.toLowerCase()}...`}
                rows={5}
              />
            </div>
          ))}

          {note.raw_transcript && (
            <div className="transcript-section">
              <div className="transcript-section__label">Transcripción</div>
              <div className="transcript-section__text">{note.raw_transcript}</div>
            </div>
          )}

          {!isSigned && (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem' }}>
              <Button variant="secondary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </Button>
              {user?.role === 'doctor' && (
                <Button onClick={handleSign} disabled={signing}>
                  {signing ? 'Firmando...' : 'Firmar nota'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
