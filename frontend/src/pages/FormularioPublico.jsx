import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import '../styles/forms.css';

export default function FormularioPublico() {
  const { token } = useParams();
  const [form, setForm]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [answers, setAnswers]   = useState({});
  const [patient, setPatient]   = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    api.get(`/api/forms/public/${token}`)
      .then(r => {
        setForm(r.data.form);
        // Inicializar respuestas vacías
        const init = {};
        (r.data.form.questions || []).forEach(q => {
          init[q.id] = q.tipo === 'casillas' ? [] : '';
        });
        setAnswers(init);
      })
      .catch(err => setError(err.response?.data?.error || 'Formulario no disponible'))
      .finally(() => setLoading(false));
  }, [token]);

  function setAnswer(qId, value) {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  }

  function toggleCasilla(qId, opcion) {
    setAnswers(prev => {
      const current = prev[qId] || [];
      return {
        ...prev,
        [qId]: current.includes(opcion)
          ? current.filter(v => v !== opcion)
          : [...current, opcion],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validar requeridas
    const faltantes = (form.questions || []).filter(q => {
      if (!q.requerido) return false;
      const a = answers[q.id];
      if (Array.isArray(a)) return a.length === 0;
      return !a || String(a).trim() === '';
    });
    if (faltantes.length > 0) {
      alert(`Por favor responde las preguntas marcadas como obligatorias: ${faltantes.map(q => `"${q.pregunta}"`).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/forms/public/${token}/submit`, {
        patient_name:  patient.name,
        patient_email: patient.email,
        patient_phone: patient.phone,
        answers,
      });
      setSubmitted(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar. Intenta de nuevo.');
    } finally { setSubmitting(false); }
  }

  const doctor = form?.doctors;
  const initials = doctor ? `${doctor.first_name?.[0] || ''}${doctor.last_name?.[0] || ''}`.toUpperCase() : 'N';

  if (loading) {
    return (
      <div className="public-form-page">
        <PublicHeader />
        <div className="public-form-main">
          <div className="public-form-card">
            <div className="public-form-card__accent" />
            <div className="public-form-card__body" style={{ textAlign: 'center', padding: '3rem', color: 'var(--ink-40)' }}>
              Cargando formulario...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-form-page">
        <PublicHeader />
        <div className="public-form-main">
          <div className="public-form-card">
            <div className="public-form-card__accent" style={{ background: 'var(--error)' }} />
            <div className="public-form-card__body" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
              <p style={{ fontWeight: 500, color: 'var(--ink)', marginBottom: '0.35rem' }}>Formulario no disponible</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-40)' }}>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-form-page">
      <PublicHeader />
      <div className="public-form-main">
        <div className="public-form-card">
          <div className="public-form-card__accent" />
          <div className="public-form-card__body">

            {/* Doctor info */}
            {doctor && (
              <div className="public-form-card__doctor">
                <div className="public-form-card__doctor-avatar">{initials}</div>
                <span>Dr. {doctor.first_name} {doctor.last_name} · {doctor.specialty}</span>
              </div>
            )}

            {submitted ? (
              <div className="public-form-success">
                <div className="public-form-success__icon">✓</div>
                <h2 className="public-form-success__title">¡Formulario enviado!</h2>
                <p className="public-form-success__desc">
                  Tu información fue recibida correctamente. El médico la revisará antes de tu consulta.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h1 className="public-form-title">{form.title}</h1>
                {form.description && <p className="public-form-desc">{form.description}</p>}

                {/* Datos del paciente */}
                <div className="public-patient-fields">
                  <div className="public-patient-field">
                    <label className="public-patient-label">Nombre completo <span style={{color:'var(--error)'}}>*</span></label>
                    <input className="public-patient-input" required value={patient.name}
                      onChange={e => setPatient(p => ({ ...p, name: e.target.value }))}
                      placeholder="Tu nombre completo" />
                  </div>
                  <div className="public-patient-field">
                    <label className="public-patient-label">Teléfono</label>
                    <input className="public-patient-input" value={patient.phone}
                      onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))}
                      placeholder="Ej. 81 1234 5678" type="tel" />
                  </div>
                  <div className="public-patient-field public-patient-field--full">
                    <label className="public-patient-label">Correo electrónico</label>
                    <input className="public-patient-input" value={patient.email}
                      onChange={e => setPatient(p => ({ ...p, email: e.target.value }))}
                      placeholder="tu@correo.com" type="email" />
                  </div>
                </div>

                {/* Preguntas */}
                <div className="public-questions">
                  {(form.questions || []).map((q, idx) => (
                    <div key={q.id} className="public-question">
                      <div className="public-question__num">Pregunta {idx + 1}</div>
                      <div className="public-question__text">
                        {q.pregunta}
                        {q.requerido && <span className="public-question__required">*</span>}
                      </div>
                      <QuestionInput q={q} value={answers[q.id]} onChange={v => setAnswer(q.id, v)} onToggle={op => toggleCasilla(q.id, op)} />
                    </div>
                  ))}
                </div>

                <button type="submit" className="public-submit-btn" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar formulario'}
                </button>
              </form>
            )}
          </div>

          <div className="public-form-footer">
            Formulario creado con <strong>Nōta</strong> · Plataforma médica inteligente
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionInput({ q, value, onChange, onToggle }) {
  switch (q.tipo) {
    case 'texto_corto':
      return <input className="public-answer-input" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Tu respuesta..." />;

    case 'texto_largo':
      return <textarea className="public-answer-input public-answer-textarea" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Tu respuesta..." rows={4} />;

    case 'fecha':
      return <input type="date" className="public-answer-input" value={value || ''} onChange={e => onChange(e.target.value)} />;

    case 'numero':
      return <input type="number" className="public-answer-input" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="0" style={{ maxWidth: 180 }} />;

    case 'escala':
      return (
        <div>
          <div className="public-scale">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} type="button" className={`public-scale-btn ${String(value) === String(n) ? 'public-scale-btn--selected' : ''}`}
                onClick={() => onChange(n)}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--ink-40)', marginTop: '0.35rem', maxWidth: 430 }}>
            <span>Sin dolor / Muy malo</span>
            <span>Máximo dolor / Excelente</span>
          </div>
        </div>
      );

    case 'opcion_multiple':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {(q.opciones || []).map((op, i) => (
            <label key={i} className={`public-option ${value === op ? 'public-option--selected' : ''}`}>
              <input type="radio" name={q.id} value={op} checked={value === op} onChange={() => onChange(op)} style={{ accentColor: 'var(--forest-mid)' }} />
              <span className="public-option__label">{op}</span>
            </label>
          ))}
        </div>
      );

    case 'casillas':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {(q.opciones || []).map((op, i) => (
            <label key={i} className={`public-option ${(value || []).includes(op) ? 'public-option--selected' : ''}`}>
              <input type="checkbox" value={op} checked={(value || []).includes(op)} onChange={() => onToggle(op)} style={{ accentColor: 'var(--forest-mid)' }} />
              <span className="public-option__label">{op}</span>
            </label>
          ))}
        </div>
      );

    default:
      return <input className="public-answer-input" value={value || ''} onChange={e => onChange(e.target.value)} />;
  }
}

function PublicHeader() {
  return (
    <header className="public-form-header">
      <div className="public-form-header__mark"><span>ō</span></div>
      <span className="public-form-header__name">N<em>ō</em>ta</span>
    </header>
  );
}
