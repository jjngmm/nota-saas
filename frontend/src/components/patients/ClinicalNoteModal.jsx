import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Button from '../ui/Button';
import '../../styles/clinical_notes.css';

const SOAP_FIELDS = [
  { key: 'subjective', label: 'Subjetivo', hint: 'S' },
  { key: 'objective', label: 'Objetivo', hint: 'O' },
  { key: 'assessment', label: 'Análisis', hint: 'A' },
  { key: 'plan', label: 'Plan', hint: 'P' },
];

function StatusBadge({ status }) {
  return (
    <span className={`note-status-badge note-status-badge--${status}`}>
      {status === 'signed' ? '✓ Firmada' : '● Borrador'}
    </span>
  );
}

export default function ClinicalNoteModal({ note: initialNote, onClose, onSaved }) {
  const { user } = useAuth();
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [scribeStatus, setScribeStatus] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const isSigned = note.status === 'signed';

  const handleChange = (field, value) => {
    setNote((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/clinical-notes/${note.id}`, {
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
      });
      setNote(data.data);
      onSaved?.(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const { data } = await api.post(`/clinical-notes/${note.id}/sign`);
      setNote(data.data);
      onSaved?.(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSigning(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = handleRecordingStop;
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setScribeStatus('Grabando...');
    } catch (err) {
      setScribeStatus('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  };

  const handleRecordingStop = async () => {
    setScribeStatus('Transcribiendo...');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        const { data: txData } = await api.post('/scribe/transcribe', { audio: base64 });
        const transcript = txData.transcript;
        setNote((prev) => ({ ...prev, raw_transcript: transcript }));

        setScribeStatus('Generando nota SOAP...');
        const { data: soapData } = await api.post('/scribe/generate-soap', {
          transcript,
          note_id: note.id,
        });
        setNote((prev) => ({
          ...prev,
          subjective: soapData.subjective ?? prev.subjective,
          objective: soapData.objective ?? prev.objective,
          assessment: soapData.assessment ?? prev.assessment,
          plan: soapData.plan ?? prev.plan,
        }));
        setScribeStatus('SOAP generado — revisa y edita antes de firmar');
      } catch (err) {
        setScribeStatus('Error al procesar el audio');
      }
    };
    reader.readAsDataURL(blob);
  };

  return (
    <div className="clinical-note-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="clinical-note-modal">
        <div className="clinical-note-modal__header">
          <div>
            <h2 className="clinical-note-modal__title">Nota Clínica</h2>
            <div className="clinical-note-modal__meta">
              {note.created_at && new Date(note.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <StatusBadge status={note.status} />
            <button className="clinical-note-modal__close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="clinical-note-modal__body">
          {/* AI Scribe */}
          {!isSigned && (
            <div className="scribe-bar">
              <button
                className={`scribe-bar__record-btn scribe-bar__record-btn--${recording ? 'recording' : 'idle'}`}
                onClick={recording ? stopRecording : startRecording}
              >
                {recording && <span className="scribe-bar__dot" />}
                {recording ? 'Detener grabación' : '🎙 Grabar consulta'}
              </button>
              {scribeStatus && <span className="scribe-bar__status">{scribeStatus}</span>}
            </div>
          )}

          {/* SOAP */}
          {SOAP_FIELDS.map(({ key, label, hint }) => (
            <div key={key} className="soap-section">
              <div className="soap-section__label">
                {label} <span>{hint}</span>
              </div>
              <textarea
                value={note[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                readOnly={isSigned}
                placeholder={isSigned ? '' : `Ingresa ${label.toLowerCase()}...`}
                rows={4}
              />
            </div>
          ))}

          {/* Transcripción */}
          {note.raw_transcript && (
            <div className="transcript-section">
              <div className="transcript-section__label">Transcripción</div>
              <div className="transcript-section__text">{note.raw_transcript}</div>
            </div>
          )}
        </div>

        {!isSigned && (
          <div className="clinical-note-modal__footer">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <div className="clinical-note-modal__actions">
              <Button variant="secondary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </Button>
              {user?.role === 'doctor' && (
                <Button variant="primary" onClick={handleSign} disabled={signing}>
                  {signing ? 'Firmando...' : 'Firmar nota'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
