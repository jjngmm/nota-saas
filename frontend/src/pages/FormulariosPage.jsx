import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import api from '../services/api';
import '../styles/forms.css';

const TIPOS = [
  { value: 'texto_corto',    label: 'Texto corto',      icon: '✏️' },
  { value: 'texto_largo',    label: 'Texto largo',       icon: '📝' },
  { value: 'opcion_multiple',label: 'Opción múltiple',   icon: '🔘' },
  { value: 'casillas',       label: 'Casillas',          icon: '☑️' },
  { value: 'fecha',          label: 'Fecha',             icon: '📅' },
  { value: 'numero',         label: 'Número',            icon: '🔢' },
  { value: 'escala',         label: 'Escala 1–10',       icon: '📊' },
];

function newPregunta(idx) {
  return { id: `q${Date.now()}_${idx}`, tipo: 'texto_corto', pregunta: '', requerido: true, opciones: ['', ''] };
}

const BASE_URL = import.meta.env.VITE_APP_URL || window.location.origin;

// ══════════════════════════════════════════════════════════════
export default function FormulariosPage() {
  const [view, setView]       = useState('list'); // list | builder | responses
  const [forms, setForms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { loadForms(); }, []);

  async function loadForms() {
    setLoading(true);
    api.get('/api/forms').then(r => setForms(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  }

  async function handleToggleActive(form) {
    await api.put(`/api/forms/${form.id}`, { ...form, is_active: !form.is_active });
    loadForms();
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este formulario? Se perderán todas las respuestas.')) return;
    await api.delete(`/api/forms/${id}`);
    loadForms();
  }

  function copyLink(token) {
    navigator.clipboard.writeText(`${BASE_URL}/f/${token}`);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (view === 'builder') {
    return <FormBuilder
      initialData={selected}
      onSave={async (data) => { await loadForms(); setView('list'); setSelected(null); }}
      onCancel={() => { setView('list'); setSelected(null); }}
    />;
  }

  if (view === 'responses') {
    return <ResponsesView form={selected} onBack={() => { setView('list'); setSelected(null); }} />;
  }

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Formularios" />
        <div className="nota-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Formularios para pacientes</h1>
              <p className="page-subtitle">Crea encuestas que tus pacientes llenan antes de la consulta</p>
            </div>
            <Button onClick={() => { setSelected(null); setView('builder'); }}>
              + Nuevo formulario
            </Button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--ink-40)' }}>Cargando...</p>
          ) : forms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--ink-40)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
              <p style={{ fontWeight: 500, color: 'var(--ink)', marginBottom: '0.35rem' }}>Sin formularios todavía</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Crea tu primer formulario — sube un PDF/Word o construye las preguntas manualmente.</p>
              <Button onClick={() => setView('builder')}>Crear formulario</Button>
            </div>
          ) : (
            <div className="forms-grid">
              {forms.map(f => (
                <div key={f.id} className={`form-card ${!f.is_active ? 'form-card--inactive' : ''}`}>
                  <div className="form-card__header">
                    <div className="form-card__title">{f.title}</div>
                    <span className={`form-status-badge form-status-badge--${f.is_active ? 'active' : 'inactive'}`}>
                      {f.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {f.description && <div className="form-card__desc">{f.description}</div>}
                  <div className="form-card__meta">
                    <span>📝 {f.response_count} respuestas</span>
                    <span>📅 {new Date(f.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                    {f.expires_at && <span>⏳ Vence {new Date(f.expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                  <div className="form-card__link-row">
                    <span className="form-card__link">{BASE_URL}/f/{f.share_token}</span>
                    <button className="form-card__copy-btn" onClick={() => copyLink(f.share_token)}>
                      {copiedId === f.share_token ? '✓ Copiado' : 'Copiar link'}
                    </button>
                  </div>
                  <div className="form-card__actions">
                    <Button variant="ghost" onClick={() => { setSelected(f); setView('responses'); }}>
                      Ver respuestas ({f.response_count})
                    </Button>
                    <Button variant="ghost" onClick={() => { setSelected(f); setView('builder'); }}>Editar</Button>
                    <button
                      onClick={() => handleToggleActive(f)}
                      className="est-quick-btn"
                      style={{ fontSize: '0.78rem' }}
                    >
                      {f.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-40)', fontSize: '0.78rem', fontFamily: 'var(--font)' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CONSTRUCTOR DE FORMULARIO
// ══════════════════════════════════════════════════════════════
function FormBuilder({ initialData, onSave, onCancel }) {
  const [title, setTitle]       = useState(initialData?.title || '');
  const [desc, setDesc]         = useState(initialData?.description || '');
  const [preguntas, setPreguntas] = useState(initialData?.questions?.length ? initialData.questions : [newPregunta(0)]);
  const [expires, setExpires]   = useState(initialData?.expires_at?.split('T')[0] || '');
  const [focused, setFocused]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [parsing, setParsing]   = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [tab, setTab]           = useState('manual'); // manual | archivo
  const fileRef = useRef();

  async function handleParseFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setParsing(true); setParseMsg(`Analizando "${file.name}" con IA...`);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/forms/parse-file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.titulo && !title) setTitle(data.titulo);
      if (data.descripcion && !desc) setDesc(data.descripcion);
      if (data.preguntas?.length) setPreguntas(data.preguntas);
      setParseMsg(`✓ ${data.preguntas?.length || 0} preguntas extraídas. Revisa y edita antes de guardar.`);
      setTab('manual');
    } catch (err) {
      setParseMsg(`Error: ${err.message}`);
    } finally { setParsing(false); }
  }

  function addPregunta(tipo = 'texto_corto') {
    const p = newPregunta(preguntas.length);
    p.tipo = tipo;
    if (['opcion_multiple', 'casillas'].includes(tipo)) p.opciones = ['Opción 1', 'Opción 2'];
    setPreguntas(prev => [...prev, p]);
    setFocused(p.id);
  }

  function updatePregunta(id, updates) {
    setPreguntas(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  function deletePregunta(id) {
    setPreguntas(prev => prev.filter(p => p.id !== id));
  }

  function updateOpcion(pId, idx, val) {
    setPreguntas(prev => prev.map(p => {
      if (p.id !== pId) return p;
      const opts = [...p.opciones]; opts[idx] = val; return { ...p, opciones: opts };
    }));
  }

  function addOpcion(pId) {
    setPreguntas(prev => prev.map(p => p.id !== pId ? p : { ...p, opciones: [...p.opciones, ''] }));
  }

  function removeOpcion(pId, idx) {
    setPreguntas(prev => prev.map(p => {
      if (p.id !== pId) return p;
      return { ...p, opciones: p.opciones.filter((_, i) => i !== idx) };
    }));
  }

  async function handleSave() {
    if (!title.trim()) { alert('El formulario necesita un título'); return; }
    setSaving(true);
    try {
      const payload = { title, description: desc, questions: preguntas, expires_at: expires || null };
      if (initialData?.id) {
        await api.put(`/api/forms/${initialData.id}`, { ...initialData, ...payload });
      } else {
        await api.post('/api/forms', payload);
      }
      onSave();
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  }

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title={initialData?.id ? 'Editar formulario' : 'Nuevo formulario'} />
        <div className="nota-content">

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className={`est-quick-btn ${tab === 'manual' ? 'est-quick-btn--active' : ''}`} onClick={() => setTab('manual')}>
                ✏️ Constructor manual
              </button>
              <button className={`est-quick-btn ${tab === 'archivo' ? 'est-quick-btn--active' : ''}`} onClick={() => setTab('archivo')}>
                📄 Subir archivo
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar formulario'}</Button>
            </div>
          </div>

          {/* Tab: Subir archivo */}
          {tab === 'archivo' && (
            <div style={{ maxWidth: 540, marginBottom: '1.5rem' }}>
              <div className="form-upload-zone">
                <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleParseFile} ref={fileRef} disabled={parsing} />
                <div className="form-upload-zone__icon">{parsing ? '⏳' : '📂'}</div>
                <div className="form-upload-zone__title">{parsing ? 'Procesando con IA...' : 'Arrastra tu archivo aquí o haz click para seleccionar'}</div>
                <div className="form-upload-zone__sub">PDF, Word (.docx) o texto plano · Máx. 10 MB</div>
              </div>
              {parseMsg && (
                <div className={`form-parse-status ${parseMsg.startsWith('Error') ? '' : ''}`}
                  style={{ marginTop: '0.75rem', color: parseMsg.startsWith('Error') ? 'var(--error)' : 'var(--forest-mid)', background: parseMsg.startsWith('Error') ? 'var(--error-soft)' : 'var(--forest-soft)', borderColor: parseMsg.startsWith('Error') ? '#fecaca' : 'var(--forest-lite)' }}>
                  {parseMsg}
                </div>
              )}
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-40)', marginTop: '0.75rem', lineHeight: 1.6 }}>
                La IA leerá el documento y extraerá las preguntas automáticamente. Podrás revisar y editar antes de publicar.
              </p>
            </div>
          )}

          <div className="form-builder">
            {/* Título y descripción */}
            <div className="form-builder__header">
              <textarea
                className="form-builder__title-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título del formulario (Ej: Cuestionario de primera consulta)"
                rows={1}
              />
              <textarea
                className="form-builder__desc-input"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Descripción o instrucciones para el paciente (opcional)"
                rows={2}
              />
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink-40)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Fecha de expiración (opcional)
                  </label>
                  <input type="date" className="est-date-input" value={expires}
                    onChange={e => setExpires(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Preguntas */}
            <div className="form-questions">
              {preguntas.map((p, idx) => (
                <div key={p.id} className={`form-question ${focused === p.id ? 'form-question--focused' : ''}`}
                  onClick={() => setFocused(p.id)}>
                  <div className="form-question__bar">
                    <span className="form-question__num">{idx + 1}.</span>
                    <select
                      className="form-question__type-select"
                      value={p.tipo}
                      onChange={e => {
                        const tipo = e.target.value;
                        const opts = ['opcion_multiple', 'casillas'].includes(tipo) ? (p.opciones?.length ? p.opciones : ['Opción 1', 'Opción 2']) : p.opciones;
                        updatePregunta(p.id, { tipo, opciones: opts });
                      }}
                    >
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                    <label className="form-question__required-toggle">
                      <input type="checkbox" checked={p.requerido}
                        onChange={e => updatePregunta(p.id, { requerido: e.target.checked })} />
                      Requerida
                    </label>
                    <button className="form-question__del" onClick={e => { e.stopPropagation(); deletePregunta(p.id); }}
                      title="Eliminar pregunta">✕</button>
                  </div>
                  <div className="form-question__body">
                    <input
                      className="form-q-input"
                      value={p.pregunta}
                      onChange={e => updatePregunta(p.id, { pregunta: e.target.value })}
                      placeholder="Escribe la pregunta..."
                    />
                    {/* Preview del tipo */}
                    {p.tipo === 'texto_corto'  && <div className="form-q-preview">✏️ Campo de texto corto</div>}
                    {p.tipo === 'texto_largo'  && <div className="form-q-preview">📝 Área de texto largo</div>}
                    {p.tipo === 'fecha'        && <div className="form-q-preview">📅 Selector de fecha</div>}
                    {p.tipo === 'numero'       && <div className="form-q-preview">🔢 Campo numérico</div>}
                    {p.tipo === 'escala'       && <div className="form-q-preview">📊 Escala del 1 al 10</div>}
                    {['opcion_multiple', 'casillas'].includes(p.tipo) && (
                      <div className="form-opciones">
                        {(p.opciones || []).map((op, i) => (
                          <div key={i} className="form-opcion">
                            <div className={`form-opcion__marker ${p.tipo === 'casillas' ? 'form-opcion__marker--check' : ''}`} />
                            <input
                              className="form-opcion__input"
                              value={op}
                              onChange={e => updateOpcion(p.id, i, e.target.value)}
                              placeholder={`Opción ${i + 1}`}
                            />
                            {(p.opciones || []).length > 2 && (
                              <button className="form-opcion__del" onClick={() => removeOpcion(p.id, i)}>✕</button>
                            )}
                          </div>
                        ))}
                        <button className="form-add-opcion" onClick={() => addOpcion(p.id)}>+ Agregar opción</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar pregunta */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {TIPOS.map(t => (
                <button key={t.value} className="est-quick-btn" onClick={() => addPregunta(t.value)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VISTA DE RESPUESTAS
// ══════════════════════════════════════════════════════════════
function ResponsesView({ form, onBack }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/api/forms/${form.id}`).then(r => setData(r.data)).catch(() => {});
  }, [form.id]);

  function exportCSV() {
    if (!data?.responses?.length || !data?.form?.questions?.length) return;
    const qs = data.form.questions;
    const headers = ['Nombre', 'Email', 'Teléfono', 'Fecha', ...qs.map(q => q.pregunta)];
    const rows = data.responses.map(r => [
      r.patient_name || '', r.patient_email || '', r.patient_phone || '',
      new Date(r.submitted_at).toLocaleDateString('es-MX'),
      ...qs.map(q => {
        const a = r.answers?.[q.id];
        return Array.isArray(a) ? a.join(', ') : (a || '');
      }),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `respuestas_${form.title.replace(/\s+/g,'_')}.csv`; a.click();
  }

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Respuestas" />
        <div className="nota-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={onBack}>← Regresar</Button>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '1.4rem', color: 'var(--ink)' }}>{form.title}</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-40)' }}>{data?.responses?.length || 0} respuestas</p>
            </div>
            {data?.responses?.length > 0 && (
              <Button variant="secondary" onClick={exportCSV} style={{ marginLeft: 'auto' }}>↓ Exportar CSV</Button>
            )}
          </div>

          {!data ? (
            <p style={{ color: 'var(--ink-40)' }}>Cargando...</p>
          ) : data.responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--ink-40)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📬</div>
              <p style={{ fontWeight: 500, color: 'var(--ink)' }}>Aún sin respuestas</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>Comparte el link con tus pacientes para que llenen el formulario.</p>
            </div>
          ) : (
            data.responses.map(r => (
              <div key={r.id} className="resp-card">
                <div className="resp-card__header">
                  <div>
                    <div className="resp-card__name">{r.patient_name || 'Anónimo'}</div>
                    {r.patient_email && <div style={{ fontSize: '0.78rem', color: 'var(--ink-40)', marginTop: '1px' }}>{r.patient_email}</div>}
                  </div>
                  <div className="resp-card__date">
                    {new Date(r.submitted_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="resp-card__answers">
                  {(data.form.questions || []).map(q => (
                    <div key={q.id} className="resp-answer">
                      <div className="resp-answer__q">{q.pregunta}</div>
                      <div className="resp-answer__a">
                        {Array.isArray(r.answers?.[q.id])
                          ? r.answers[q.id].join(', ')
                          : (r.answers?.[q.id] || <span style={{ color: 'var(--ink-40)', fontStyle: 'italic' }}>Sin respuesta</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
