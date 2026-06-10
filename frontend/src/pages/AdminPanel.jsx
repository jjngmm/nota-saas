import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import api from '../services/api';

const ROLE_LABELS = { admin: 'Administrador', doctor: 'Médico', secretary: 'Secretaria' };
const ROLE_COLORS = { admin: '#7c3aed', doctor: '#2D5A3D', secretary: '#b45309' };

const SPECIALTIES = [
  'Pediatría', 'Medicina General', 'Medicina Interna', 'Cardiología', 'Dermatología',
  'Endocrinología', 'Gastroenterología', 'Ginecología y Obstetricia', 'Neurología',
  'Nutrición', 'Odontología', 'Oftalmología', 'Ortopedia y Traumatología',
  'Otorrinolaringología', 'Psicología', 'Psiquiatría', 'Urología', 'Otra',
];

function fmtDateTime(d) {
  if (!d) return 'Nunca';
  return new Date(d).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState('resumen');

  if (!user || user.role !== 'admin') {
    return (
      <div className="nota-layout">
        <Sidebar />
        <div className="nota-main">
          <Navbar title="Panel de administración" />
          <div className="nota-content">
            <div className="pp-empty">
              <div className="pp-empty__icon">🔒</div>
              <p>No tienes permisos para acceder a este panel. Tu rol actual: <strong>{ROLE_LABELS[user?.role] || 'desconocido'}</strong></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'resumen',  label: 'Resumen' },
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'medicos',  label: 'Médicos' },
    { id: 'clinica',  label: 'Clínica' },
  ];

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Panel de administración" />
        <div className="nota-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Panel de administración</h1>
              <p className="page-subtitle">Gestiona usuarios, médicos y los datos de tu clínica</p>
            </div>
          </div>

          <div className="pp-tabs" style={{ marginBottom: '1.5rem' }}>
            {TABS.map(t => (
              <button key={t.id}
                className={`pp-tab${tab === t.id ? ' pp-tab--active' : ''}`}
                onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'resumen'  && <ResumenTab onNavigate={setTab} />}
          {tab === 'usuarios' && <UsuariosTab currentUserId={user.id} />}
          {tab === 'medicos'  && <MedicosTab />}
          {tab === 'clinica'  && <ClinicaTab />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// RESUMEN
// ══════════════════════════════════════════════════════════════
function ResumenTab({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/overview')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="pp-loading">Cargando resumen...</p>;
  if (!stats) return <p className="pp-loading">No se pudo cargar el resumen.</p>;

  const CARDS = [
    { label: 'Pacientes registrados', value: stats.patients,           color: 'stat--green' },
    { label: 'Médicos activos',       value: stats.doctors,            color: 'stat--blue' },
    { label: 'Usuarios con acceso',   value: stats.users,              color: 'stat--neutral' },
    { label: 'Citas este mes',        value: stats.appointments_month, color: 'stat--green' },
  ];

  return (
    <div>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {CARDS.map(c => (
          <div key={c.label} className={`stat-card ${c.color}`}>
            <span className="stat-value">{c.value}</span>
            <span className="stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button onClick={() => onNavigate('usuarios')}>+ Crear usuario</Button>
        <Button variant="ghost" onClick={() => onNavigate('medicos')}>Gestionar médicos</Button>
        <Button variant="ghost" onClick={() => onNavigate('clinica')}>Datos de la clínica</Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// USUARIOS
// ══════════════════════════════════════════════════════════════
const EMPTY_USER = { email: '', password: '', role: 'secretary', first_name: '', last_name: '', specialty: 'Pediatría', license_number: '', phone: '' };

function UsuariosTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_USER });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetUser, setResetUser] = useState(null); // usuario al que se le resetea password
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await api.get('/api/admin/users');
      setUsers(r.data.data || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }

  function flash(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
  }

  async function handleCreate() {
    setError('');
    if (!form.email || !form.password) { setError('Email y contraseña son requeridos'); return; }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (form.role === 'doctor' && (!form.first_name || !form.last_name)) {
      setError('Para un médico se requiere nombre y apellido'); return;
    }
    setSaving(true);
    try {
      const r = await api.post('/api/admin/users', form);
      setUsers(prev => [...prev, r.data.data]);
      setShowForm(false);
      setForm({ ...EMPTY_USER });
      flash(`✓ Usuario ${r.data.data.email} creado`);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el usuario');
    } finally { setSaving(false); }
  }

  async function toggleStatus(u) {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    const verb = newStatus === 'inactive' ? 'desactivar' : 'reactivar';
    if (!confirm(`¿Seguro que quieres ${verb} a ${u.email}?`)) return;
    try {
      const r = await api.put(`/api/admin/users/${u.id}`, { status: newStatus });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: r.data.data.status } : x));
      flash(`✓ ${u.email} ${newStatus === 'active' ? 'reactivado' : 'desactivado'}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al actualizar');
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    setSaving(true);
    setError('');
    try {
      await api.put(`/api/admin/users/${resetUser.id}/password`, { new_password: newPassword });
      setResetUser(null);
      setNewPassword('');
      flash(`✓ Contraseña de ${resetUser.email} restablecida`);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer');
    } finally { setSaving(false); }
  }

  if (loading) return <p className="pp-loading">Cargando usuarios...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-40)' }}>
          {users.length} usuario{users.length !== 1 ? 's' : ''} en la clínica
        </p>
        <Button onClick={() => { setForm({ ...EMPTY_USER }); setError(''); setShowForm(true); }}>+ Nuevo usuario</Button>
      </div>

      {feedback && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '0.6rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
          {feedback}
        </div>
      )}

      <div className="est-table-wrap">
        <table className="est-table">
          <thead>
            <tr>
              <th>Email</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={u.status !== 'active' ? { opacity: 0.55 } : {}}>
                <td style={{ fontWeight: 500 }}>
                  {u.email}
                  {u.id === currentUserId && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--ink-40)' }}>(tú)</span>}
                </td>
                <td style={{ color: 'var(--ink-60)', fontSize: '0.85rem' }}>
                  {u.doctor_profile ? `${u.doctor_profile.first_name} ${u.doctor_profile.last_name}` : '—'}
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ROLE_COLORS[u.role] || 'var(--ink-60)' }}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: u.status === 'active' ? '#15803d' : '#b91c1c' }}>
                    {u.status === 'active' ? '● Activo' : '○ Inactivo'}
                  </span>
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--ink-40)' }}>{fmtDateTime(u.last_login)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <button className="est-quick-btn" style={{ fontSize: '0.72rem' }}
                      onClick={() => { setResetUser(u); setNewPassword(''); setError(''); }}>
                      Contraseña
                    </button>
                    {u.id !== currentUserId && (
                      <button className="est-quick-btn" style={{ fontSize: '0.72rem', color: u.status === 'active' ? '#b91c1c' : '#15803d' }}
                        onClick={() => toggleStatus(u)}>
                        {u.status === 'active' ? 'Desactivar' : 'Reactivar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo usuario */}
      {showForm && (
        <div className="exp-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="exp-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="exp-modal__title">Nuevo usuario</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="config-field" style={{ gridColumn: '1/-1' }}>
                <label className="config-label">Rol *</label>
                <div className="config-select-wrap">
                  <select className="config-select" value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="secretary">Secretaria — agenda, pacientes y formularios</option>
                    <option value="doctor">Médico — acceso clínico completo</option>
                    <option value="admin">Administrador — acceso total</option>
                  </select>
                </div>
              </div>

              <div className="config-field">
                <label className="config-label">Email *</label>
                <input className="config-input" type="email" value={form.email}
                  placeholder="usuario@clinica.com"
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="config-field">
                <label className="config-label">Contraseña * (mín. 8)</label>
                <input className="config-input" type="text" value={form.password}
                  placeholder="Contraseña inicial"
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>

              {form.role === 'doctor' && (
                <>
                  <div className="config-field">
                    <label className="config-label">Nombre(s) *</label>
                    <input className="config-input" value={form.first_name}
                      onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div className="config-field">
                    <label className="config-label">Apellido(s) *</label>
                    <input className="config-input" value={form.last_name}
                      onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
                  </div>
                  <div className="config-field">
                    <label className="config-label">Especialidad *</label>
                    <div className="config-select-wrap">
                      <select className="config-select" value={form.specialty}
                        onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}>
                        {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="config-field">
                    <label className="config-label">Cédula profesional</label>
                    <input className="config-input" value={form.license_number}
                      onChange={e => setForm(p => ({ ...p, license_number: e.target.value }))} />
                  </div>
                  <div className="config-field" style={{ gridColumn: '1/-1' }}>
                    <label className="config-label">Teléfono</label>
                    <input className="config-input" type="tel" value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </>
              )}
            </div>

            {error && <p style={{ color: 'var(--error, #b91c1c)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}

            <div className="exp-modal__actions">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creando...' : 'Crear usuario'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal restablecer contraseña */}
      {resetUser && (
        <div className="exp-modal-overlay" onClick={() => setResetUser(null)}>
          <div className="exp-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="exp-modal__title">Restablecer contraseña</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-60)', marginBottom: '1rem' }}>
              Nueva contraseña para <strong>{resetUser.email}</strong>
            </p>
            <div className="config-field" style={{ marginBottom: '1rem' }}>
              <label className="config-label">Nueva contraseña (mín. 8 caracteres)</label>
              <input className="config-input" type="text" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} />
            </div>
            {error && <p style={{ color: 'var(--error, #b91c1c)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}
            <div className="exp-modal__actions">
              <Button variant="ghost" onClick={() => setResetUser(null)}>Cancelar</Button>
              <Button onClick={handleResetPassword} disabled={saving || newPassword.length < 8}>
                {saving ? 'Guardando...' : 'Restablecer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MÉDICOS
// ══════════════════════════════════════════════════════════════
function MedicosTab() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // doctor en edición
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/admin/doctors')
      .then(r => setDoctors(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openEdit(d) {
    setForm({
      first_name: d.first_name || '', last_name: d.last_name || '',
      specialty: d.specialty || '', license_number: d.license_number || '',
      phone: d.phone || '',
    });
    setError('');
    setEditing(d);
  }

  async function handleSave() {
    if (!form.first_name || !form.last_name) { setError('Nombre y apellido son requeridos'); return; }
    setSaving(true);
    try {
      const r = await api.put(`/api/admin/doctors/${editing.id}`, form);
      setDoctors(prev => prev.map(d => d.id === editing.id ? r.data.data : d));
      setEditing(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function toggleActive(d) {
    const verb = d.active ? 'desactivar' : 'reactivar';
    if (!confirm(`¿Seguro que quieres ${verb} a ${d.first_name} ${d.last_name}? ${d.active ? 'Ya no aparecerá en la agenda.' : ''}`)) return;
    try {
      const r = await api.put(`/api/admin/doctors/${d.id}`, { active: !d.active });
      setDoctors(prev => prev.map(x => x.id === d.id ? r.data.data : x));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al actualizar');
    }
  }

  if (loading) return <p className="pp-loading">Cargando médicos...</p>;

  return (
    <div>
      <p style={{ fontSize: '0.85rem', color: 'var(--ink-40)', marginBottom: '1.25rem' }}>
        {doctors.length} médico{doctors.length !== 1 ? 's' : ''} registrados.
        Para dar de alta un médico nuevo con acceso al sistema, créalo desde la pestaña <strong>Usuarios</strong> con rol Médico.
      </p>

      {doctors.length === 0 ? (
        <div className="pp-empty"><div className="pp-empty__icon">🩺</div><p>Sin médicos registrados.</p></div>
      ) : (
        <div className="est-table-wrap">
          <table className="est-table">
            <thead>
              <tr><th>Nombre</th><th>Especialidad</th><th>Cédula</th><th>Teléfono</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {doctors.map(d => (
                <tr key={d.id} style={!d.active ? { opacity: 0.55 } : {}}>
                  <td style={{ fontWeight: 500 }}>{d.first_name} {d.last_name} {d.last_name_maternal || ''}</td>
                  <td style={{ color: 'var(--ink-60)', fontSize: '0.85rem' }}>{d.specialty || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-40)' }}>{d.license_number || '—'}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--ink-60)' }}>{d.phone || '—'}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d.active ? '#15803d' : '#b91c1c' }}>
                      {d.active ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button className="est-quick-btn" style={{ fontSize: '0.72rem' }} onClick={() => openEdit(d)}>Editar</button>
                      <button className="est-quick-btn" style={{ fontSize: '0.72rem', color: d.active ? '#b91c1c' : '#15803d' }}
                        onClick={() => toggleActive(d)}>
                        {d.active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="exp-modal-overlay" onClick={() => setEditing(null)}>
          <div className="exp-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="exp-modal__title">Editar médico</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="config-field">
                <label className="config-label">Nombre(s) *</label>
                <input className="config-input" value={form.first_name}
                  onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="config-field">
                <label className="config-label">Apellido(s) *</label>
                <input className="config-input" value={form.last_name}
                  onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
              <div className="config-field">
                <label className="config-label">Especialidad</label>
                <div className="config-select-wrap">
                  <select className="config-select" value={form.specialty}
                    onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}>
                    {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="config-field">
                <label className="config-label">Cédula profesional</label>
                <input className="config-input" value={form.license_number}
                  onChange={e => setForm(p => ({ ...p, license_number: e.target.value }))} />
              </div>
              <div className="config-field" style={{ gridColumn: '1/-1' }}>
                <label className="config-label">Teléfono</label>
                <input className="config-input" type="tel" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            {error && <p style={{ color: 'var(--error, #b91c1c)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}
            <div className="exp-modal__actions">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CLÍNICA
// ══════════════════════════════════════════════════════════════
function ClinicaTab() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/admin/organization')
      .then(r => setForm(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!form.name?.trim()) { setError('El nombre de la clínica es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const r = await api.put('/api/admin/organization', {
        name: form.name, email: form.email, phone: form.phone,
        address: form.address, city: form.city, rfc: form.rfc, razon_social: form.razon_social,
      });
      setForm(r.data.data);
      setFeedback('✓ Datos de la clínica guardados');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  }

  if (loading) return <p className="pp-loading">Cargando datos de la clínica...</p>;
  if (!form) return <p className="pp-loading">No se pudieron cargar los datos.</p>;

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div style={{ maxWidth: 640 }}>
      {feedback && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '0.6rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
        <div className="config-field" style={{ gridColumn: '1/-1' }}>
          <label className="config-label">Nombre de la clínica *</label>
          <input className="config-input" value={form.name || ''} onChange={set('name')} />
        </div>
        <div className="config-field">
          <label className="config-label">Email de contacto</label>
          <input className="config-input" type="email" value={form.email || ''} onChange={set('email')} />
        </div>
        <div className="config-field">
          <label className="config-label">Teléfono</label>
          <input className="config-input" type="tel" value={form.phone || ''} onChange={set('phone')} />
        </div>
        <div className="config-field" style={{ gridColumn: '1/-1' }}>
          <label className="config-label">Dirección</label>
          <input className="config-input" value={form.address || ''} onChange={set('address')} />
        </div>
        <div className="config-field">
          <label className="config-label">Ciudad</label>
          <input className="config-input" value={form.city || ''} onChange={set('city')} />
        </div>
        <div className="config-field">
          <label className="config-label">RFC</label>
          <input className="config-input" value={form.rfc || ''} onChange={set('rfc')} />
        </div>
        <div className="config-field" style={{ gridColumn: '1/-1' }}>
          <label className="config-label">Razón social</label>
          <input className="config-input" value={form.razon_social || ''} onChange={set('razon_social')} />
        </div>
      </div>

      {error && <p style={{ color: 'var(--error, #b91c1c)', fontSize: '0.82rem', marginTop: '0.75rem' }}>{error}</p>}

      <div style={{ marginTop: '1.5rem' }}>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
      </div>
    </div>
  );
}
