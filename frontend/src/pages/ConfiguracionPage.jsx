import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import '../styles/configuracion.css';

// ─── Constantes ───────────────────────────────────────────────
const SPECIALTIES = [
  'Cardiología','Dermatología','Endocrinología','Gastroenterología',
  'Ginecología y Obstetricia','Medicina General','Medicina Interna',
  'Neurología','Nutrición','Odontología','Oftalmología','Oncología',
  'Ortopedia y Traumatología','Otorrinolaringología','Pediatría',
  'Psicología','Psiquiatría','Radiología','Reumatología','Urología','Otra',
];

const TEMPLATE_TYPES = [
  { value: 'carta_salud', label: 'Carta de salud' },
  { value: 'dieta', label: 'Dieta' },
  { value: 'ejercicios', label: 'Ejercicios' },
  { value: 'recomendaciones', label: 'Recomendaciones' },
  { value: 'otro', label: 'Otro' },
];

const CONSULTA_FIELDS = [
  { key: 'nom_024', label: 'Certificado NOM-024', desc: 'Cumplimiento normativo de expediente electrónico' },
  { key: 'edad_paciente', label: 'Edad del paciente' },
  { key: 'padecimiento_actual', label: 'Padecimiento Actual / Nota de evolución' },
  { key: 'signos_vitales', label: 'Signos vitales (Antropométricos)' },
  { key: 'exploracion_fisica', label: 'Exploración Física' },
  { key: 'instrumentos_monitoreo', label: 'Mis instrumentos de monitoreo' },
  { key: 'analisis', label: 'Análisis / Apreciativo' },
  { key: 'estudios_laboratorio', label: 'Estudios de Laboratorio' },
  { key: 'pruebas_laboratorio', label: 'Pruebas de laboratorio a monitorear' },
  { key: 'plantillas_diagramas', label: 'Plantillas de diagramas' },
  { key: 'diagnosticos', label: 'Diagnósticos' },
  { key: 'grabacion_voz', label: 'Grabación de voz (Beta)', desc: 'Nota de evolución, Exploración física, Estudios, Análisis y Notas' },
  { key: 'receta', label: 'Receta' },
  { key: 'ingrediente_activo', label: 'Agregar "Ingrediente Activo" al medicamento' },
  { key: 'tablas', label: 'Tablas' },
  { key: 'orden_laboratorio_libre', label: 'Orden de laboratorio (Libre)' },
  { key: 'ordenes_compuesto', label: 'Órdenes (Compuesto)' },
  { key: 'campo_personalizado', label: 'Campo personalizado', desc: 'Nombre que aparecerá en cada consulta', type: 'text' },
  { key: 'plan_notas', label: 'Plan o Notas para siguiente consulta' },
  { key: 'proxima_cita', label: 'Próxima cita' },
  { key: 'cumplimiento_normativo', label: 'Cumplimiento Normativo Servicio de Atención' },
  { key: 'fotos', label: 'Fotos' },
];

const DEFAULT_CONSULTA = Object.fromEntries(
  CONSULTA_FIELDS.map(f => [f.key, f.type === 'text' ? '' : true])
);

const NAV_SECTIONS = [
  { group: 'Cuenta', items: [
    { id: 'perfil', icon: '👤', label: 'Perfil' },
    { id: 'papeleria', icon: '📄', label: 'Papelería' },
    { id: 'agenda', icon: '📅', label: 'Agenda' },
    { id: 'asistente', icon: '🤝', label: 'Asistente' },
  ]},
  { group: 'Consulta', items: [
    { id: 'personalizacion', icon: '⚙️', label: 'Personalización' },
    { id: 'historia_clinica', icon: '📋', label: 'Historia clínica' },
    { id: 'parametros', icon: '📊', label: 'Parámetros' },
    { id: 'plantillas', icon: '📝', label: 'Info para pacientes' },
  ]},
  { group: 'Finanzas', items: [
    { id: 'cobros', icon: '💳', label: 'Cobros online' },
    { id: 'reporte', icon: '📈', label: 'Reporte normativo' },
  ]},
];

// ─── Toast helper ──────────────────────────────────────────────
function useSaveToast() {
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => {
    setVisible(true);
    setTimeout(() => setVisible(false), 2500);
  }, []);
  return [visible, show];
}

// ─── Toggle component ──────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label className="config-toggle">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="config-toggle__track" />
    </label>
  );
}

// ══════════════════════════════════════════════════════════════
export default function ConfiguracionPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('perfil');
  const [configData, setConfigData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastVisible, showToast] = useSaveToast();

  useEffect(() => {
    api.get('/api/config/doctor').then(res => {
      setConfigData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="nota-layout">
        <Sidebar />
        <div className="nota-main">
          <Navbar title="Configuración" />
          <div className="nota-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p style={{ color: 'var(--ink-40)' }}>Cargando configuración...</p>
          </div>
        </div>
      </div>
    );
  }

  const sharedProps = { configData, setConfigData, showToast };

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Configuración" />
        <div className="config-layout">
          {/* Sidebar de secciones */}
          <nav className="config-sidebar">
            {NAV_SECTIONS.map(group => (
              <div key={group.group}>
                <div className="config-sidebar__label">{group.group}</div>
                {group.items.map(item => (
                  <button
                    key={item.id}
                    className={`config-nav-item ${activeSection === item.id ? 'config-nav-item--active' : ''}`}
                    onClick={() => setActiveSection(item.id)}
                  >
                    <span className="config-nav-item__icon">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Contenido */}
          <main className="config-main">
            {activeSection === 'perfil'         && <PerfilSection {...sharedProps} />}
            {activeSection === 'papeleria'      && <PapeleriaSection {...sharedProps} />}
            {activeSection === 'agenda'         && <AgendaSection {...sharedProps} />}
            {activeSection === 'asistente'      && <AsistenteSection {...sharedProps} />}
            {activeSection === 'personalizacion'&& <PersonalizacionSection {...sharedProps} />}
            {activeSection === 'historia_clinica'&& <HistoriaClinicaSection {...sharedProps} />}
            {activeSection === 'parametros'     && <ParametrosSection {...sharedProps} />}
            {activeSection === 'plantillas'     && <PlantillasSection {...sharedProps} />}
            {activeSection === 'cobros'         && <CobrosSection {...sharedProps} />}
            {activeSection === 'reporte'        && <ReporteSection />}
          </main>
        </div>
      </div>

      {toastVisible && <div className="config-save-toast">✓ Cambios guardados</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PERFIL
// ══════════════════════════════════════════════════════════════
function PerfilSection({ configData, setConfigData, showToast }) {
  const doc = configData?.doctor || {};
  const [form, setForm] = useState({
    first_name: doc.first_name || '',
    last_name: doc.last_name || '',
    last_name_maternal: doc.last_name_maternal || '',
    specialty: doc.specialty || '',
    phone: doc.phone || '',
    license_number: doc.license_number || '',
    bio: doc.bio || '',
    address: doc.address || '',
    colonia: doc.colonia || '',
    ciudad: doc.ciudad || '',
    estado: doc.estado || '',
    codigo_postal: doc.codigo_postal || '',
    profile_image_url: doc.profile_image_url || '',
    google_calendar_sync: doc.google_calendar_sync || false,
    google_sheets_sync: doc.google_sheets_sync || false,
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState(false);

  const initials = `${form.first_name[0] || ''}${form.last_name[0] || ''}`.toUpperCase();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put('/api/config/perfil', form);
      setConfigData(prev => ({ ...prev, doctor: res.data.data }));
      showToast();
    } catch (e) {} finally { setSaving(false); }
  }

  async function handlePasswordSave() {
    setPwError(''); setPwOk(false);
    if (pwForm.new_password !== pwForm.confirm) { setPwError('Las contraseñas no coinciden'); return; }
    setSavingPw(true);
    try {
      await api.put('/api/config/password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwOk(true);
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e) { setPwError(e.response?.data?.error || 'Error al cambiar contraseña'); }
    finally { setSavingPw(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Perfil</h2>
      <p className="config-section__sub">Tu información personal y de contacto</p>

      {/* Foto */}
      <div className="config-card">
        <div className="config-card__title">Foto de perfil</div>
        <div className="config-avatar-row">
          {form.profile_image_url
            ? <img src={form.profile_image_url} className="config-avatar" alt="Foto" />
            : <div className="config-avatar">{initials || '?'}</div>
          }
          <div className="config-avatar-actions">
            <div className="config-field">
              <label className="config-label">URL de foto</label>
              <input className="config-input" style={{width: 260}} value={form.profile_image_url}
                onChange={e => setForm(p => ({...p, profile_image_url: e.target.value}))}
                placeholder="https://..." />
            </div>
            <span className="config-avatar-hint">Ingresa la URL de tu foto de perfil</span>
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div className="config-card">
        <div className="config-card__title">Datos personales</div>
        <div className="config-grid">
          <Field label="Nombre(s)" value={form.first_name} onChange={v => setForm(p=>({...p,first_name:v}))} />
          <Field label="Apellido paterno" value={form.last_name} onChange={v => setForm(p=>({...p,last_name:v}))} />
          <Field label="Apellido materno" value={form.last_name_maternal} onChange={v => setForm(p=>({...p,last_name_maternal:v}))} />
          <Field label="Teléfono" value={form.phone} onChange={v => setForm(p=>({...p,phone:v}))} />
          <div className="config-field">
            <label className="config-label">Especialidad</label>
            <div className="config-select-wrap">
              <select className="config-select" value={form.specialty} onChange={e => setForm(p=>({...p,specialty:e.target.value}))}>
                <option value="">Selecciona...</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <Field label="Cédula profesional" value={form.license_number} onChange={v => setForm(p=>({...p,license_number:v}))} />
          <div className="config-field config-grid--full">
            <label className="config-label">Acerca de mí / Presentación</label>
            <textarea className="config-textarea" value={form.bio} onChange={e => setForm(p=>({...p,bio:e.target.value}))} rows={3} placeholder="Breve descripción profesional..." />
          </div>
        </div>
      </div>

      {/* Dirección */}
      <div className="config-card">
        <div className="config-card__title">Dirección del consultorio</div>
        <div className="config-grid">
          <div className="config-field config-grid--full">
            <label className="config-label">Calle y número</label>
            <input className="config-input" value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} placeholder="Ej. Av. Constitución 1234 Interior 5" />
          </div>
          <Field label="Colonia" value={form.colonia} onChange={v => setForm(p=>({...p,colonia:v}))} />
          <Field label="Ciudad" value={form.ciudad} onChange={v => setForm(p=>({...p,ciudad:v}))} />
          <Field label="Estado" value={form.estado} onChange={v => setForm(p=>({...p,estado:v}))} />
          <Field label="Código postal" value={form.codigo_postal} onChange={v => setForm(p=>({...p,codigo_postal:v}))} />
        </div>
      </div>

      {/* Sincronización Google */}
      <div className="config-card">
        <div className="config-card__title">Sincronización con Google</div>
        <div className="config-sync-item">
          <div className="config-sync-item__left">
            <div className="config-sync-item__icon">📅</div>
            <div>
              <div className="config-sync-item__title">Google Calendar</div>
              <div className="config-sync-item__desc">Sincroniza tus citas con tu calendario de Google</div>
            </div>
          </div>
          <Toggle checked={form.google_calendar_sync} onChange={v => setForm(p=>({...p,google_calendar_sync:v}))} />
        </div>
        <div className="config-sync-item">
          <div className="config-sync-item__left">
            <div className="config-sync-item__icon">📊</div>
            <div>
              <div className="config-sync-item__title">Google Sheets</div>
              <div className="config-sync-item__desc">Exporta reportes de pacientes y citas automáticamente</div>
            </div>
          </div>
          <Toggle checked={form.google_sheets_sync} onChange={v => setForm(p=>({...p,google_sheets_sync:v}))} />
        </div>
      </div>

      <div className="config-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar perfil'}</Button>
      </div>

      {/* Contraseña */}
      <div className="config-card" style={{marginTop:'1.5rem'}}>
        <div className="config-card__title">Cambiar contraseña</div>
        <div className="config-grid">
          <Field label="Contraseña actual" type="password" value={pwForm.current_password} onChange={v => setPwForm(p=>({...p,current_password:v}))} />
          <div />
          <Field label="Nueva contraseña" type="password" value={pwForm.new_password} onChange={v => setPwForm(p=>({...p,new_password:v}))} hint="Mínimo 8 caracteres" />
          <Field label="Confirmar contraseña" type="password" value={pwForm.confirm} onChange={v => setPwForm(p=>({...p,confirm:v}))} />
        </div>
        {pwError && <p style={{color:'var(--error)',fontSize:'0.82rem',marginTop:'0.5rem'}}>{pwError}</p>}
        {pwOk && <p style={{color:'var(--forest-mid)',fontSize:'0.82rem',marginTop:'0.5rem'}}>✓ Contraseña actualizada</p>}
        <div className="config-actions">
          <Button onClick={handlePasswordSave} disabled={savingPw}>{savingPw ? 'Guardando...' : 'Cambiar contraseña'}</Button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PAPELERÍA
// ══════════════════════════════════════════════════════════════
function PapeleriaSection({ configData, setConfigData, showToast }) {
  const pap = configData?.papeleria || {};
  const doc = configData?.doctor || {};
  const [form, setForm] = useState({
    logo_url: pap.logo_url || '',
    header_text: pap.header_text || '',
    footer_text: pap.footer_text || '',
    color_primary: pap.color_primary || '#2D5A3D',
    show_license: pap.show_license !== false,
    show_address: pap.show_address !== false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put('/api/config/papeleria', form);
      setConfigData(prev => ({...prev, papeleria: res.data.data}));
      showToast();
    } catch(e) {} finally { setSaving(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Papelería</h2>
      <p className="config-section__sub">Personaliza tu hoja membretada, recetas y órdenes de laboratorio</p>

      <div className="config-card">
        <div className="config-card__title">Logotipo</div>
        <div className="config-field">
          <label className="config-label">URL del logo</label>
          <input className="config-input" value={form.logo_url} onChange={e => setForm(p=>({...p,logo_url:e.target.value}))} placeholder="https://..." />
        </div>
      </div>

      <div className="config-card">
        <div className="config-card__title">Encabezado y pie de página</div>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div className="config-field">
            <label className="config-label">Texto del encabezado</label>
            <textarea className="config-textarea" rows={3} value={form.header_text}
              onChange={e => setForm(p=>({...p,header_text:e.target.value}))}
              placeholder="Ej. Consultorio médico especializado en Cardiología. Av. Constitución 1234, Col. Centro." />
          </div>
          <div className="config-field">
            <label className="config-label">Pie de página</label>
            <textarea className="config-textarea" rows={2} value={form.footer_text}
              onChange={e => setForm(p=>({...p,footer_text:e.target.value}))}
              placeholder="Ej. Tel. 81 1234 5678 · consultorio@email.com" />
          </div>
        </div>
      </div>

      <div className="config-card">
        <div className="config-card__title">Opciones de visualización</div>
        <div className="config-toggle-list">
          <div className="config-toggle-item">
            <div className="config-toggle-item__info">
              <div className="config-toggle-item__label">Mostrar cédula profesional</div>
            </div>
            <Toggle checked={form.show_license} onChange={v => setForm(p=>({...p,show_license:v}))} />
          </div>
          <div className="config-toggle-item">
            <div className="config-toggle-item__info">
              <div className="config-toggle-item__label">Mostrar dirección del consultorio</div>
            </div>
            <Toggle checked={form.show_address} onChange={v => setForm(p=>({...p,show_address:v}))} />
          </div>
        </div>
      </div>

      {/* Vista previa */}
      <div className="config-card">
        <div className="config-card__title">Vista previa</div>
        <div className="papeleria-preview">
          <div className="papeleria-preview__header">
            <div className="papeleria-preview__logo">
              {form.logo_url ? <img src={form.logo_url} alt="Logo" /> : 'Logo'}
            </div>
            <div className="papeleria-preview__doctor-info">
              <div className="papeleria-preview__name">Dr. {doc.first_name} {doc.last_name}</div>
              <div className="papeleria-preview__specialty">{doc.specialty}</div>
              {form.show_license && doc.license_number && <div style={{fontSize:'0.72rem',color:'var(--ink-40)'}}>Cédula: {doc.license_number}</div>}
            </div>
          </div>
          {form.header_text && <p style={{fontSize:'0.78rem',color:'var(--ink-40)',marginBottom:'0.5rem'}}>{form.header_text}</p>}
          <div style={{height:40,borderBottom:'0.5px dashed var(--cream-mid)',marginBottom:'0.5rem'}} />
          {form.footer_text && <p style={{fontSize:'0.72rem',color:'var(--ink-40)',marginTop:'0.5rem',borderTop:'0.5px solid var(--cream-mid)',paddingTop:'0.5rem'}}>{form.footer_text}</p>}
        </div>
      </div>

      <div className="config-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar papelería'}</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// AGENDA
// ══════════════════════════════════════════════════════════════
const DAYS = [
  {id:'monday',label:'Lunes'}, {id:'tuesday',label:'Martes'},
  {id:'wednesday',label:'Miércoles'}, {id:'thursday',label:'Jueves'},
  {id:'friday',label:'Viernes'}, {id:'saturday',label:'Sábado'},
  {id:'sunday',label:'Domingo'},
];

function AgendaSection({ showToast }) {
  const [schedule, setSchedule] = useState(
    Object.fromEntries(DAYS.map(d => [d.id, { active: !['saturday','sunday'].includes(d.id), start: '09:00', end: '18:00' }]))
  );
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get('/api/doctors/me/availability').then(res => {
      if (res.data && res.data.length > 0) {
        const mapped = {};
        res.data.forEach(a => { mapped[a.day_of_week] = { active: true, start: a.start_time, end: a.end_time }; });
        setSchedule(prev => {
          const next = {...prev};
          DAYS.forEach(d => { if (mapped[d.id]) next[d.id] = {...mapped[d.id]}; else next[d.id] = {...prev[d.id], active: false}; });
          return next;
        });
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = DAYS.filter(d => schedule[d.id].active).map(d => ({
        day_of_week: d.id,
        start_time: schedule[d.id].start,
        end_time: schedule[d.id].end,
      }));
      await api.post('/api/doctors/me/availability', { availability: payload });
      showToast();
    } catch(e) {} finally { setSaving(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Agenda</h2>
      <p className="config-section__sub">Define los días y horarios en que atiendes pacientes</p>

      <div className="config-card">
        <div className="config-card__title">Horario de atención</div>
        <div className="config-toggle-list">
          {DAYS.map(d => (
            <div key={d.id} className="config-toggle-item">
              <div className="config-toggle-item__info" style={{display:'flex',alignItems:'center',gap:'1rem'}}>
                <Toggle checked={schedule[d.id].active} onChange={v => setSchedule(p=>({...p,[d.id]:{...p[d.id],active:v}}))} />
                <span className="config-toggle-item__label" style={{minWidth:90}}>{d.label}</span>
                {schedule[d.id].active && (
                  <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                    <input type="time" className="config-input" style={{width:110}} value={schedule[d.id].start}
                      onChange={e => setSchedule(p=>({...p,[d.id]:{...p[d.id],start:e.target.value}}))} />
                    <span style={{color:'var(--ink-40)',fontSize:'0.85rem'}}>a</span>
                    <input type="time" className="config-input" style={{width:110}} value={schedule[d.id].end}
                      onChange={e => setSchedule(p=>({...p,[d.id]:{...p[d.id],end:e.target.value}}))} />
                  </div>
                )}
              </div>
              {!schedule[d.id].active && <span style={{fontSize:'0.78rem',color:'var(--ink-40)'}}>No disponible</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="config-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar horario'}</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ASISTENTE
// ══════════════════════════════════════════════════════════════
function AsistenteSection({ configData }) {
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const orgId = configData?.doctor?.org_id;

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      await api.post('/api/auth/signup', { orgId, email: form.email, password: form.password });
      setMsg('✓ Asistente registrado correctamente. Ya puede iniciar sesión.');
      setForm({ email: '', password: '', name: '' });
    } catch(e) { setMsg(e.response?.data?.error || 'Error al registrar asistente'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Asistente</h2>
      <p className="config-section__sub">Registra a tu asistente o recepcionista para que gestione tu agenda</p>

      <div className="config-card">
        <div className="config-card__title">Crear cuenta de asistente</div>
        <form onSubmit={handleCreate}>
          <div className="config-grid">
            <Field label="Nombre completo" value={form.name} onChange={v => setForm(p=>({...p,name:v}))} placeholder="Ej. Laura García" />
            <Field label="Correo electrónico" type="email" value={form.email} onChange={v => setForm(p=>({...p,email:v}))} placeholder="asistente@correo.com" />
            <Field label="Contraseña temporal" type="password" value={form.password} onChange={v => setForm(p=>({...p,password:v}))} hint="Mínimo 8 caracteres" />
          </div>
          {msg && <p style={{fontSize:'0.83rem',marginTop:'0.75rem',color: msg.startsWith('✓') ? 'var(--forest-mid)' : 'var(--error)'}}>{msg}</p>}
          <div className="config-actions">
            <Button type="submit" disabled={saving || !form.email || !form.password}>{saving ? 'Registrando...' : 'Registrar asistente'}</Button>
          </div>
        </form>
      </div>

      <div className="config-card" style={{background:'var(--cream)',border:'none'}}>
        <p style={{fontSize:'0.83rem',color:'var(--ink-40)',lineHeight:1.6}}>
          El asistente tendrá acceso como <strong>secretaria</strong> — podrá gestionar citas y pacientes, pero no tendrá acceso a notas clínicas ni configuración del médico.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PERSONALIZACIÓN DE CONSULTA
// ══════════════════════════════════════════════════════════════
function PersonalizacionSection({ configData, setConfigData, showToast }) {
  const saved = configData?.consulta_config?.config || {};
  const [config, setConfig] = useState({ ...DEFAULT_CONSULTA, ...saved });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put('/api/config/consulta', {
        config,
        historia_clinica_config: configData?.consulta_config?.historia_clinica_config || {},
        parametros_config: configData?.consulta_config?.parametros_config || {},
      });
      setConfigData(prev => ({...prev, consulta_config: res.data.data}));
      showToast();
    } catch(e) {} finally { setSaving(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Personalización de consulta</h2>
      <p className="config-section__sub">Activa o desactiva los apartados que aparecen en cada consulta</p>

      <div className="config-card">
        <div className="config-toggle-list">
          {CONSULTA_FIELDS.map(f => (
            <div key={f.key} className="config-toggle-item">
              <div className="config-toggle-item__info">
                <div className="config-toggle-item__label">{f.label}</div>
                {f.desc && <div className="config-toggle-item__desc">{f.desc}</div>}
                {f.type === 'text' && config[f.key] !== undefined && (
                  <input className="config-input" style={{marginTop:'0.4rem',maxWidth:280}}
                    placeholder="Nombre del campo personalizado..."
                    value={config[f.key]}
                    onChange={e => setConfig(p=>({...p,[f.key]:e.target.value}))} />
                )}
              </div>
              {f.type !== 'text' && (
                <Toggle checked={config[f.key]} onChange={v => setConfig(p=>({...p,[f.key]:v}))} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="config-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HISTORIA CLÍNICA — NOM-004-SSA3
// ══════════════════════════════════════════════════════════════
const HC_FIELDS = [
  { key: 'ficha_identificacion', label: 'Ficha de identificación', desc: 'Nombre, fecha de nacimiento, sexo, ocupación, estado civil, domicilio' },
  { key: 'antecedentes_heredo', label: 'Antecedentes heredo-familiares' },
  { key: 'antecedentes_personales_np', label: 'Antecedentes personales no patológicos', desc: 'Alimentación, higiene, vivienda, hábitos' },
  { key: 'antecedentes_personales_p', label: 'Antecedentes personales patológicos', desc: 'Enfermedades previas, cirugías, alergias, medicamentos' },
  { key: 'antecedentes_gineco', label: 'Antecedentes ginecoobstétricos', desc: 'Solo para pacientes femeninas' },
  { key: 'padecimiento_actual', label: 'Padecimiento actual', desc: 'Motivo de consulta, inicio, evolución, síntomas asociados' },
  { key: 'interrogatorio_sistemas', label: 'Interrogatorio por aparatos y sistemas' },
  { key: 'exploracion_fisica', label: 'Exploración física', desc: 'Signos vitales, exploración general y por sistemas' },
  { key: 'resultados_previos', label: 'Resultados de estudios previos' },
  { key: 'diagnostico', label: 'Diagnóstico o problema clínico' },
  { key: 'pronostico', label: 'Pronóstico' },
  { key: 'tratamiento', label: 'Plan de tratamiento' },
];

function HistoriaClinicaSection({ configData, setConfigData, showToast }) {
  const saved = configData?.consulta_config?.historia_clinica_config || {};
  const [config, setConfig] = useState(Object.fromEntries(HC_FIELDS.map(f => [f.key, saved[f.key] !== false])));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put('/api/config/consulta', {
        config: configData?.consulta_config?.config || DEFAULT_CONSULTA,
        historia_clinica_config: config,
        parametros_config: configData?.consulta_config?.parametros_config || {},
      });
      setConfigData(prev => ({...prev, consulta_config: res.data.data}));
      showToast();
    } catch(e) {} finally { setSaving(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Historia clínica</h2>
      <p className="config-section__sub">Configura las secciones basadas en la NOM-004-SSA3-2012</p>

      <div className="config-card">
        <div className="config-toggle-list">
          {HC_FIELDS.map(f => (
            <div key={f.key} className="config-toggle-item">
              <div className="config-toggle-item__info">
                <div className="config-toggle-item__label">{f.label}</div>
                {f.desc && <div className="config-toggle-item__desc">{f.desc}</div>}
              </div>
              <Toggle checked={config[f.key]} onChange={v => setConfig(p=>({...p,[f.key]:v}))} />
            </div>
          ))}
        </div>
      </div>

      <div className="config-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PARÁMETROS
// ══════════════════════════════════════════════════════════════
const PARAM_GROUPS = [
  { key: 'signos_vitales', label: 'Signos vitales', params: [
    'Frecuencia cardíaca','Presión arterial','Temperatura','Frecuencia respiratoria',
    'Saturación de oxígeno (SpO₂)','Peso','Talla','IMC','Perímetro abdominal',
  ]},
  { key: 'laboratorios', label: 'Laboratorios', params: [
    'Glucosa','HbA1c','Colesterol total','HDL','LDL','Triglicéridos',
    'Creatinina','Urea','Ácido úrico','TSH','T4 libre',
    'Hemoglobina','Hematocrito','Leucocitos','Plaquetas',
  ]},
  { key: 'embarazo', label: 'Seguimiento de embarazo', params: [
    'Semanas de gestación','Peso materno','Altura uterina','FCF','Movimientos fetales',
    'Presión arterial','Glucosa en ayunas','Proteinuria',
  ]},
];

function ParametrosSection({ configData, setConfigData, showToast }) {
  const saved = configData?.consulta_config?.parametros_config || {};
  const [config, setConfig] = useState(
    Object.fromEntries(PARAM_GROUPS.map(g => [
      g.key,
      Object.fromEntries(g.params.map(p => [p, saved[g.key]?.[p] !== false]))
    ]))
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put('/api/config/consulta', {
        config: configData?.consulta_config?.config || DEFAULT_CONSULTA,
        historia_clinica_config: configData?.consulta_config?.historia_clinica_config || {},
        parametros_config: config,
      });
      setConfigData(prev => ({...prev, consulta_config: res.data.data}));
      showToast();
    } catch(e) {} finally { setSaving(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Parámetros a monitorear</h2>
      <p className="config-section__sub">Selecciona los parámetros que registras en cada consulta</p>

      {PARAM_GROUPS.map(g => (
        <div key={g.key} className="config-card" style={{marginBottom:'1rem'}}>
          <div className="config-card__title">{g.label}</div>
          <div className="config-toggle-list">
            {g.params.map(p => (
              <div key={p} className="config-toggle-item">
                <div className="config-toggle-item__label">{p}</div>
                <Toggle checked={config[g.key][p]} onChange={v => setConfig(prev => ({...prev,[g.key]:{...prev[g.key],[p]:v}}))} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="config-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar parámetros'}</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PLANTILLAS PARA PACIENTES
// ══════════════════════════════════════════════════════════════
function PlantillasSection({ showToast }) {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: 'recomendaciones', title: '', content: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/config/templates').then(r => setTemplates(r.data.data || [])).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/api/config/templates/${editing.id}`, form);
        setTemplates(p => p.map(t => t.id === editing.id ? res.data.data : t));
      } else {
        const res = await api.post('/api/config/templates', form);
        setTemplates(p => [res.data.data, ...p]);
      }
      setEditing(null); setCreating(false);
      setForm({ type: 'recomendaciones', title: '', content: '' });
      showToast();
    } catch(e) {} finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await api.delete(`/api/config/templates/${id}`);
    setTemplates(p => p.filter(t => t.id !== id));
  }

  function startEdit(t) {
    setEditing(t); setCreating(true);
    setForm({ type: t.type, title: t.title, content: t.content || '' });
  }

  return (
    <div>
      <h2 className="config-section__title">Información para pacientes</h2>
      <p className="config-section__sub">Crea machotes: cartas de salud, dietas, ejercicios y recomendaciones</p>

      {!creating ? (
        <>
          <div style={{marginBottom:'1rem'}}>
            <Button onClick={() => { setCreating(true); setEditing(null); setForm({type:'recomendaciones',title:'',content:''}); }}>+ Nueva plantilla</Button>
          </div>
          {templates.length === 0
            ? <div className="config-card" style={{textAlign:'center',color:'var(--ink-40)',padding:'2rem'}}>
                <p>Aún no tienes plantillas.</p>
                <p style={{fontSize:'0.82rem',marginTop:'0.3rem'}}>Crea cartas de salud, dietas, ejercicios o recomendaciones para tus pacientes.</p>
              </div>
            : <div className="config-template-list">
                {templates.map(t => (
                  <div key={t.id} className="config-template-card">
                    <div className="config-template-card__info">
                      <div className="config-template-card__title">{t.title}</div>
                      <div className="config-template-card__type">{TEMPLATE_TYPES.find(x=>x.value===t.type)?.label || t.type}</div>
                    </div>
                    <div className="config-template-card__actions">
                      <Button variant="ghost" onClick={() => startEdit(t)}>Editar</Button>
                      <Button variant="ghost" onClick={() => handleDelete(t.id)}>Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>
      ) : (
        <div className="config-card">
          <div className="config-card__title">{editing ? 'Editar plantilla' : 'Nueva plantilla'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div className="config-grid">
              <div className="config-field">
                <label className="config-label">Tipo</label>
                <div className="config-select-wrap">
                  <select className="config-select" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                    {TEMPLATE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <Field label="Título" value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Ej. Dieta para diabetes tipo 2" />
            </div>
            <div className="config-field">
              <label className="config-label">Contenido</label>
              <textarea className="config-textarea" rows={10} value={form.content}
                onChange={e=>setForm(p=>({...p,content:e.target.value}))}
                placeholder="Escribe el contenido de la plantilla..." />
            </div>
          </div>
          <div className="config-actions">
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Guardando...' : 'Guardar plantilla'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COBROS ONLINE
// ══════════════════════════════════════════════════════════════
function CobrosSection({ configData, setConfigData, showToast }) {
  const pay = configData?.payment_config || {};
  const [form, setForm] = useState({
    mercadopago_enabled: pay.mercadopago_enabled || false,
    mercadopago_key: pay.mercadopago_key || '',
    paypal_enabled: pay.paypal_enabled || false,
    paypal_email: pay.paypal_email || '',
    transfer_enabled: pay.transfer_enabled || false,
    transfer_bank: pay.transfer_bank || '',
    transfer_clabe: pay.transfer_clabe || '',
    transfer_titular: pay.transfer_titular || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put('/api/config/pagos', form);
      setConfigData(prev => ({...prev, payment_config: res.data.data}));
      showToast();
    } catch(e) {} finally { setSaving(false); }
  }

  return (
    <div>
      <h2 className="config-section__title">Cobros online</h2>
      <p className="config-section__sub">Activa los métodos de pago que aceptas en tu consultorio</p>

      {/* MercadoPago */}
      <div className="config-cobro-section">
        <div className="config-cobro-header">
          <div className="config-cobro-header__left">
            <span>💳</span> MercadoPago
          </div>
          <Toggle checked={form.mercadopago_enabled} onChange={v => setForm(p=>({...p,mercadopago_enabled:v}))} />
        </div>
        {form.mercadopago_enabled && (
          <div className="config-cobro-body">
            <Field label="Clave de acceso (Access Token)" value={form.mercadopago_key}
              onChange={v=>setForm(p=>({...p,mercadopago_key:v}))} placeholder="APP_USR-..." />
          </div>
        )}
      </div>

      {/* PayPal */}
      <div className="config-cobro-section">
        <div className="config-cobro-header">
          <div className="config-cobro-header__left">
            <span>🅿️</span> PayPal
          </div>
          <Toggle checked={form.paypal_enabled} onChange={v => setForm(p=>({...p,paypal_enabled:v}))} />
        </div>
        {form.paypal_enabled && (
          <div className="config-cobro-body">
            <Field label="Correo de PayPal" type="email" value={form.paypal_email}
              onChange={v=>setForm(p=>({...p,paypal_email:v}))} placeholder="tu@paypal.com" />
          </div>
        )}
      </div>

      {/* Transferencia */}
      <div className="config-cobro-section">
        <div className="config-cobro-header">
          <div className="config-cobro-header__left">
            <span>🏦</span> Transferencia electrónica
          </div>
          <Toggle checked={form.transfer_enabled} onChange={v => setForm(p=>({...p,transfer_enabled:v}))} />
        </div>
        {form.transfer_enabled && (
          <div className="config-cobro-body">
            <div className="config-grid">
              <Field label="Banco" value={form.transfer_bank} onChange={v=>setForm(p=>({...p,transfer_bank:v}))} placeholder="Ej. BBVA" />
              <Field label="Titular de la cuenta" value={form.transfer_titular} onChange={v=>setForm(p=>({...p,transfer_titular:v}))} />
              <div className="config-field config-grid--full">
                <label className="config-label">CLABE interbancaria</label>
                <input className="config-input" value={form.transfer_clabe}
                  onChange={e=>setForm(p=>({...p,transfer_clabe:e.target.value}))}
                  placeholder="18 dígitos" maxLength={18} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="config-actions">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración de cobros'}</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// REPORTE NORMATIVO
// ══════════════════════════════════════════════════════════════
function ReporteSection() {
  return (
    <div>
      <h2 className="config-section__title">Reporte normativo</h2>
      <p className="config-section__sub">Informes de cumplimiento y estadísticas de atención</p>
      <div className="config-card" style={{textAlign:'center',padding:'3rem 1rem',color:'var(--ink-40)'}}>
        <div style={{fontSize:'2rem',marginBottom:'0.75rem'}}>📈</div>
        <p style={{fontWeight:500,color:'var(--ink)'}}>Próximamente</p>
        <p style={{fontSize:'0.85rem',marginTop:'0.35rem'}}>Los reportes normativos estarán disponibles en la siguiente versión.</p>
      </div>
    </div>
  );
}

// ─── Field helper ──────────────────────────────────────────────
function Field({ label, value, onChange, type='text', placeholder='', hint }) {
  return (
    <div className="config-field">
      <label className="config-label">{label}</label>
      <input className="config-input" type={type} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <span className="config-password-hint">{hint}</span>}
    </div>
  );
}
