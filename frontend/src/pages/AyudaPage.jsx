import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import api from '../services/api';
import '../styles/ayuda.css';

// ─── Datos de contenido ───────────────────────────────────────

const VIDEOS = [
  { id: 'v1', youtubeId: 'dQw4w9WgXcQ', tag: 'Primeros pasos', title: 'Cómo configurar tu cuenta de médico', dur: '4:32' },
  { id: 'v2', youtubeId: 'dQw4w9WgXcQ', tag: 'Citas', title: 'Gestión de citas y calendario', dur: '6:15' },
  { id: 'v3', youtubeId: 'dQw4w9WgXcQ', tag: 'Pacientes', title: 'Registro y expediente del paciente', dur: '5:48' },
  { id: 'v4', youtubeId: 'dQw4w9WgXcQ', tag: 'Expediente', title: 'Cómo llenar una nota clínica SOAP', dur: '7:20' },
  { id: 'v5', youtubeId: 'dQw4w9WgXcQ', tag: 'IA Scribe', title: 'Dictado automático con IA (Beta)', dur: '3:55' },
  { id: 'v6', youtubeId: 'dQw4w9WgXcQ', tag: 'Papelería', title: 'Personalizar recetas y membrete', dur: '4:10' },
  { id: 'v7', youtubeId: 'dQw4w9WgXcQ', tag: 'Valeria', title: 'Configurar a Valeria, tu recepcionista IA', dur: '8:05' },
  { id: 'v8', youtubeId: 'dQw4w9WgXcQ', tag: 'Cobros', title: 'Activar cobros con MercadoPago', dur: '5:00' },
];

const NOVEDADES = [
  {
    fecha: { dia: '7', mes: 'Jun', año: '2026' },
    badge: 'nueva', badgeLabel: 'Nueva función',
    title: 'Módulo de Expediente Clínico',
    desc: 'Ya puedes registrar notas clínicas SOAP directamente desde la consulta.',
    items: ['Formato SOAP completo (Subjetivo, Objetivo, Análisis, Plan)', 'Firma digital de notas', 'Historial por paciente en el expediente'],
  },
  {
    fecha: { dia: '7', mes: 'Jun', año: '2026' },
    badge: 'beta', badgeLabel: 'Beta',
    title: 'AI Scribe — Dictado automático',
    desc: 'Graba la consulta y Nōta genera automáticamente la nota SOAP con IA.',
    items: ['Transcripción con OpenAI Whisper', 'Generación SOAP con Claude', 'El médico revisa y firma'],
  },
  {
    fecha: { dia: '6', mes: 'Jun', año: '2026' },
    badge: 'mejora', badgeLabel: 'Mejora',
    title: 'Registro público de médicos',
    desc: 'Los médicos ahora pueden registrarse directamente desde la landing page en /registro.',
    items: ['Formulario con especialidad y datos completos', 'Organización propia creada automáticamente', 'Sesión iniciada al registrarse'],
  },
  {
    fecha: { dia: '5', mes: 'Jun', año: '2026' },
    badge: 'mejora', badgeLabel: 'Mejora',
    title: 'Módulo de configuración del médico',
    desc: 'Nueva sección de configuración con 10 apartados completos.',
    items: ['Perfil, papelería, agenda, asistente', 'Personalización de consulta (22 campos)', 'Historia clínica NOM-004-SSA3', 'Cobros online (MercadoPago, PayPal, transferencia)'],
  },
  {
    fecha: { dia: '4', mes: 'Jun', año: '2026' },
    badge: 'correc', badgeLabel: 'Corrección',
    title: 'Login optimizado',
    desc: 'El inicio de sesión ahora no requiere el UUID de la organización. Basta con email y contraseña.',
    items: ['Búsqueda de clínica por nombre', 'Login con solo email+contraseña si es único', 'Mensajes de error en español'],
  },
];

const FAQ_CATS = ['Todos', 'Cuenta', 'Citas', 'Expediente', 'Facturación', 'Valeria'];

const FAQS = [
  { cat: 'Cuenta', q: '¿Cómo cambio mi foto de perfil?', a: 'Ve a Configuración → Perfil. Ingresa la URL de tu foto en el campo "URL de foto". Puedes usar servicios como Imgur o Google Drive para alojar tu imagen.' },
  { cat: 'Cuenta', q: '¿Cómo registro a mi asistente?', a: 'En Configuración → Asistente, ingresa el correo y contraseña temporal de tu asistente. Se creará una cuenta con rol de secretaria vinculada a tu organización.' },
  { cat: 'Cuenta', q: '¿Puedo tener más de un consultorio?', a: 'Actualmente cada registro crea una organización independiente. Si tienes múltiples consultorios, contáctanos en soporte@nota.mx para configurarlo.' },
  { cat: 'Citas', q: '¿Cómo agenda citas Valeria automáticamente?', a: 'Valeria usa los horarios que configuras en Configuración → Agenda. Llama al paciente, verifica disponibilidad en tiempo real y registra la cita. Solo necesitas activarla desde el módulo de Valeria.' },
  { cat: 'Citas', q: '¿Puedo cancelar o reprogramar citas?', a: 'Sí. En el módulo de Citas, haz click en cualquier cita y selecciona "Editar" para cambiar fecha/hora, o "Cancelar cita" para cancelarla. El paciente recibe notificación automática.' },
  { cat: 'Citas', q: '¿Los pacientes reciben recordatorios?', a: 'Sí, Valeria envía confirmación por WhatsApp al agendar y un recordatorio 24 horas antes de la cita.' },
  { cat: 'Expediente', q: '¿Qué es el formato SOAP?', a: 'SOAP es la estructura estándar de nota clínica: Subjetivo (lo que reporta el paciente), Objetivo (exploración física y signos vitales), Análisis (diagnóstico) y Plan (tratamiento). Es el estándar de la NOM-004-SSA3.' },
  { cat: 'Expediente', q: '¿Puedo editar una nota firmada?', a: 'No. Una vez que firmas una nota clínica, queda bloqueada para garantizar la integridad del expediente conforme a la NOM. Para correcciones, crea una nota de evolución nueva.' },
  { cat: 'Expediente', q: '¿Cómo funciona el AI Scribe?', a: 'Presiona "Grabar consulta" en la nota clínica. Al detener la grabación, Nōta transcribe el audio con Whisper y genera automáticamente los 4 campos SOAP con Claude. Tú revisas y editas antes de firmar.' },
  { cat: 'Facturación', q: '¿Cómo activo cobros con MercadoPago?', a: 'Ve a Configuración → Cobros online → activa MercadoPago e ingresa tu Access Token. Lo obtienes en tu cuenta de MercadoPago → Desarrolladores → Credenciales de producción.' },
  { cat: 'Facturación', q: '¿Nōta cobra comisión por las transacciones?', a: 'No. Nōta no cobra comisión. Las tarifas son las que aplica directamente MercadoPago o PayPal según su tabla de comisiones vigente.' },
  { cat: 'Valeria', q: '¿Qué puede hacer Valeria exactamente?', a: 'Valeria contesta llamadas telefónicas, verifica disponibilidad en tiempo real, agenda citas, confirma datos con el paciente y registra la cita en el sistema. Funciona 24/7 sin intervención manual.' },
  { cat: 'Valeria', q: '¿En qué idioma habla Valeria?', a: 'Valeria habla en español mexicano neutro. Usa tu nombre de clínica y tu catálogo de médicos para presentarse correctamente.' },
  { cat: 'Valeria', q: '¿Valeria puede reprogramar citas existentes?', a: 'Actualmente Valeria puede agendar nuevas citas. La reprogramación y cancelación por llamada está en el roadmap para la siguiente versión.' },
];

const SUG_CATS = [
  { value: 'funcionalidad', label: 'Nueva funcionalidad' },
  { value: 'mejora', label: 'Mejora de algo existente' },
  { value: 'diseno', label: 'Diseño o experiencia' },
  { value: 'integracion', label: 'Integración con otro sistema' },
  { value: 'otro', label: 'Otro' },
];

const SUG_IDEAS = [
  'Recetas electrónicas firmadas', 'App móvil para médico', 'Integración con IMSS/ISSSTE',
  'Estadísticas de consulta', 'Chat con pacientes', 'Recordatorios por SMS',
  'Firma con biometría', 'Módulo de laboratorio',
];

// ═══════════════════════════════════════════════════════
export default function AyudaPage() {
  const [tab, setTab] = useState('videos');

  const TABS = [
    { id: 'videos',      label: 'Videotutoriales', icon: '▶' },
    { id: 'novedades',   label: 'Novedades',        icon: '✦' },
    { id: 'sugerencias', label: 'Sugerencias',      icon: '💡' },
    { id: 'faq',         label: 'Preguntas frecuentes', icon: '?' },
  ];

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Ayuda" />
        <div className="nota-content">

          <div className="page-header">
            <div>
              <h1 className="page-title">Centro de ayuda</h1>
              <p className="page-subtitle">Tutoriales, novedades y soporte para sacarle el máximo a Nōta</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="ayuda-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`ayuda-tab ${tab === t.id ? 'ayuda-tab--active' : ''}`}
                onClick={() => setTab(t.id)}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {tab === 'videos'      && <VideosTab />}
          {tab === 'novedades'   && <NovedadesTab />}
          {tab === 'sugerencias' && <SugerenciasTab />}
          {tab === 'faq'         && <FaqTab />}

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// VIDEOTUTORIALES
// ═══════════════════════════════════════════════════════
function VideosTab() {
  const [activeVideo, setActiveVideo] = useState(null);

  return (
    <>
      <div className="videos-grid">
        {VIDEOS.map(v => (
          <div key={v.id} className="video-card" onClick={() => setActiveVideo(v)}>
            <div className="video-thumb">
              <img
                src={`https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`}
                alt={v.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div className="video-thumb__play">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div className="video-card__body">
              <span className="video-card__tag">{v.tag}</span>
              <div className="video-card__title">{v.title}</div>
              <div className="video-card__dur">⏱ {v.dur}</div>
            </div>
          </div>
        ))}
      </div>

      {activeVideo && (
        <div className="video-modal-overlay" onClick={() => setActiveVideo(null)}>
          <div className="video-modal" onClick={e => e.stopPropagation()}>
            <div className="video-modal__header">
              <span className="video-modal__title">{activeVideo.title}</span>
              <button className="video-modal__close" onClick={() => setActiveVideo(null)}>✕</button>
            </div>
            <iframe
              className="video-modal__iframe"
              src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={activeVideo.title}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════
// NOVEDADES
// ═══════════════════════════════════════════════════════
function NovedadesTab() {
  return (
    <div className="novedades-list">
      {NOVEDADES.map((n, i) => (
        <div key={i} className="novedad-card">
          <div className="novedad-card__date-col">
            <span className="novedad-card__month">{n.fecha.mes}</span>
            <span className="novedad-card__day">{n.fecha.dia}</span>
            <span className="novedad-card__year">{n.fecha.año}</span>
          </div>
          <div className="novedad-card__content">
            <span className={`novedad-card__badge badge-${n.badge}`}>{n.badgeLabel}</span>
            <div className="novedad-card__title">{n.title}</div>
            <div className="novedad-card__desc">{n.desc}</div>
            {n.items && (
              <ul className="novedad-card__items">
                {n.items.map((item, j) => <li key={j}>· {item}</li>)}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUGERENCIAS
// ═══════════════════════════════════════════════════════
function SugerenciasTab() {
  const [form, setForm] = useState({ categoria: 'funcionalidad', titulo: '', mensaje: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function fillIdea(idea) {
    setForm(p => ({ ...p, titulo: idea }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.titulo || !form.mensaje) { setError('Completa el título y el mensaje'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/api/ayuda/sugerencia', form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar. Intenta de nuevo.');
    } finally { setLoading(false); }
  }

  return (
    <div className="sugerencias-wrap">
      {success ? (
        <div className="sug-form">
          <div className="sug-success">
            <div className="sug-success__icon">✓</div>
            <p className="sug-success__title">¡Gracias por tu sugerencia!</p>
            <p className="sug-success__desc">La revisamos personalmente. Tu feedback hace que Nōta mejore para todos los médicos.</p>
            <Button onClick={() => { setSuccess(false); setForm({ categoria: 'funcionalidad', titulo: '', mensaje: '' }); }}>
              Enviar otra sugerencia
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form className="sug-form" onSubmit={handleSubmit}>
            <div className="sug-field">
              <label className="sug-label">Categoría</label>
              <div className="sug-select-wrap">
                <select className="sug-select" value={form.categoria}
                  onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  {SUG_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="sug-field">
              <label className="sug-label">¿Qué mejorarías o agregarías?</label>
              <input className="sug-input" value={form.titulo}
                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej. Poder generar recetas en PDF desde la consulta" />
            </div>
            <div className="sug-field">
              <label className="sug-label">Cuéntanos más</label>
              <textarea className="sug-textarea" value={form.mensaje}
                onChange={e => setForm(p => ({ ...p, mensaje: e.target.value }))}
                placeholder="Describe el problema que resolvería o cómo lo usarías en tu práctica diaria..." />
            </div>
            {error && <p style={{ color: 'var(--error)', fontSize: '0.83rem' }}>{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar sugerencia'}
            </Button>
          </form>

          <div className="sug-ideas">
            <div className="sug-ideas__title">Ideas populares — haz click para usarlas</div>
            <div className="sug-ideas__grid">
              {SUG_IDEAS.map(idea => (
                <button key={idea} className="sug-idea-chip" onClick={() => fillIdea(idea)}>
                  {idea}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FAQ
// ═══════════════════════════════════════════════════════
function FaqTab() {
  const [cat, setCat] = useState('Todos');
  const [open, setOpen] = useState(null);

  const filtered = cat === 'Todos' ? FAQS : FAQS.filter(f => f.cat === cat);

  return (
    <div>
      <div className="faq-cats">
        {FAQ_CATS.map(c => (
          <button key={c} className={`faq-cat ${cat === c ? 'faq-cat--active' : ''}`}
            onClick={() => { setCat(c); setOpen(null); }}>
            {c}
          </button>
        ))}
      </div>

      <div className="faq-list">
        {filtered.map((f, i) => (
          <div key={i} className={`faq-item ${open === i ? 'faq-item--open' : ''}`}>
            <button className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
              <span className="faq-question__text">{f.q}</span>
              <span className="faq-question__icon">+</span>
            </button>
            {open === i && <div className="faq-answer">{f.a}</div>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'var(--cream)', borderRadius: 10, border: '0.5px solid var(--cream-mid)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-40)', lineHeight: 1.6 }}>
          ¿No encontraste tu respuesta?{' '}
          <a href="mailto:soporte@nota.mx" style={{ color: 'var(--forest-mid)', fontWeight: 500 }}>
            Escríbenos a soporte@nota.mx
          </a>
          {' '}y te respondemos en menos de 24 horas.
        </p>
      </div>
    </div>
  );
}
