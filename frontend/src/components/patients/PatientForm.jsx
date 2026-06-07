import { useState, useEffect } from 'react';
import api from '../../services/api';
import Button from '../ui/Button';

// ─── Constantes ────────────────────────────────────────────────
const GENDER_OPTS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const BLOOD_OPTS = [
  { value: '', label: 'Seleccionar...' },
  ...['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => ({ value: t, label: t })),
];

const ESTADO_CIVIL_OPTS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'soltero', label: 'Soltero/a' },
  { value: 'casado', label: 'Casado/a' },
  { value: 'union_libre', label: 'Unión libre' },
  { value: 'divorciado', label: 'Divorciado/a' },
  { value: 'viudo', label: 'Viudo/a' },
  { value: 'separado', label: 'Separado/a' },
];

const RELATIONSHIP_OPTS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'padre', label: 'Padre' },
  { value: 'madre', label: 'Madre' },
  { value: 'tutor', label: 'Tutor/a legal' },
  { value: 'abuelo', label: 'Abuelo/a' },
  { value: 'hermano', label: 'Hermano/a' },
  { value: 'otro', label: 'Otro' },
];

const EMPTY = {
  first_name: '', last_name: '', last_name_maternal: '',
  birth_date: '', gender: '',
  phone: '', email: '',
  curp: '', blood_type: '',
  address: '', colonia: '', ciudad: '', estado: '', codigo_postal: '',
  estado_civil: '', ocupacion: '',
  allergies: '', notes: '',
  privacy_accepted: false,
  // Acompañante
  companion_first_name: '', companion_last_name: '', companion_last_name_maternal: '',
  companion_relationship: '', companion_email: '', companion_phone: '', companion_dob: '',
};

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// ══════════════════════════════════════════════════════════════
export default function PatientForm({ patient, onSuccess, onClose }) {
  const isEditing = !!patient;
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const age = calcAge(form.birth_date);
  const isMinor = age !== null && age < 18;

  useEffect(() => {
    if (patient) {
      setForm({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        last_name_maternal: patient.last_name_maternal || '',
        birth_date: patient.birth_date || '',
        gender: patient.gender || '',
        phone: patient.phone || '',
        email: patient.email || '',
        curp: patient.curp || '',
        blood_type: patient.blood_type || '',
        address: patient.address || '',
        colonia: patient.colonia || '',
        ciudad: patient.ciudad || '',
        estado: patient.estado || '',
        codigo_postal: patient.codigo_postal || '',
        estado_civil: patient.estado_civil || '',
        ocupacion: patient.ocupacion || '',
        allergies: patient.allergies || '',
        notes: patient.notes || '',
        privacy_accepted: patient.privacy_accepted || false,
        companion_first_name: patient.companion_first_name || '',
        companion_last_name: patient.companion_last_name || '',
        companion_last_name_maternal: patient.companion_last_name_maternal || '',
        companion_relationship: patient.companion_relationship || '',
        companion_email: patient.companion_email || '',
        companion_phone: patient.companion_phone || '',
        companion_dob: patient.companion_dob || '',
      });
    }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function set(name, value) {
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    set(name, type === 'checkbox' ? checked : value);
  }

  function validate() {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Requerido';
    if (!form.last_name.trim())  errs.last_name  = 'Requerido';
    if (!form.birth_date)        errs.birth_date  = 'Requerida';
    if (!form.gender)            errs.gender      = 'Requerido';
    if (!form.privacy_accepted)  errs.privacy     = 'Debes aceptar el aviso de privacidad';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido';
    if (form.curp && form.curp.length !== 18) errs.curp = 'La CURP debe tener 18 caracteres';
    if (isMinor && !form.companion_first_name.trim()) errs.companion_first_name = 'Requerido';
    if (isMinor && !form.companion_last_name.trim())  errs.companion_last_name  = 'Requerido';
    if (isMinor && !form.companion_relationship)       errs.companion_relationship = 'Requerida';
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Ir a la tab con el primer error
      if (errs.first_name || errs.last_name || errs.birth_date || errs.gender) setTab('personal');
      else if (errs.email) setTab('contacto');
      return;
    }

    setSaving(true); setApiError('');
    try {
      let res;
      if (isEditing) {
        res = await api.patch(`/api/patients/${patient.id}`, form);
        onSuccess(res.data);
      } else {
        res = await api.post('/api/patients', form);
        onSuccess(res.data);
      }
    } catch (err) {
      setApiError(err.response?.data?.error || 'Error al guardar el paciente');
    } finally { setSaving(false); }
  }

  // Tabs dinámicas
  const TABS = [
    { id: 'personal',   label: 'Datos personales' },
    { id: 'contacto',   label: isMinor ? 'Acompañante' : 'Contacto' },
    { id: 'adicional',  label: 'Información adicional' },
    { id: 'medico',     label: 'Datos médicos' },
  ];

  const hasError = (keys) => keys.some(k => errors[k]);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--lg">

        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{isEditing ? 'Editar paciente' : 'Nuevo paciente'}</h3>
            <p className="modal-subtitle">
              {isEditing ? `Editando: ${patient.first_name} ${patient.last_name}` : 'Completa los datos del paciente'}
              {isMinor && <span style={{ marginLeft: '0.5rem', background: '#FEF3C7', color: '#92400E', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 20 }}>Menor de edad</span>}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`modal-tab ${tab === t.id ? 'modal-tab--active' : ''}`}
              onClick={() => setTab(t.id)} style={{ position: 'relative' }}>
              {t.label}
              {/* Punto de error */}
              {(t.id === 'personal' && hasError(['first_name','last_name','birth_date','gender'])) && <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--error)' }} />}
              {(t.id === 'contacto' && hasError(['email','companion_first_name','companion_last_name','companion_relationship'])) && <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--error)' }} />}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {apiError && <div className="form-error-banner" style={{ marginBottom: '1rem', padding: '0.65rem 0.9rem', background: 'var(--error-soft)', border: '1px solid #fecaca', borderRadius: 8, color: 'var(--error)', fontSize: '0.85rem' }}>{apiError}</div>}

          {/* ── TAB: DATOS PERSONALES ── */}
          {tab === 'personal' && (
            <div className="form-grid">
              <F label="Nombre(s)" required error={errors.first_name}>
                <input className="input-el" name="first_name" value={form.first_name} onChange={handleChange} placeholder="Ej. María Elena" />
              </F>
              <F label="Apellido paterno" required error={errors.last_name}>
                <input className="input-el" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Ej. García" />
              </F>
              <F label="Apellido materno">
                <input className="input-el" name="last_name_maternal" value={form.last_name_maternal} onChange={handleChange} placeholder="Ej. López" />
              </F>
              <F label="Fecha de nacimiento" required error={errors.birth_date}>
                <input type="date" className="input-el" name="birth_date" value={form.birth_date} onChange={handleChange} />
                {age !== null && (
                  <span style={{ fontSize: '0.75rem', color: isMinor ? '#92400E' : 'var(--text-3)', marginTop: 3 }}>
                    {age} años {isMinor ? '· Menor de edad — se solicitarán datos del acompañante' : ''}
                  </span>
                )}
              </F>
              <F label="Sexo" required error={errors.gender}>
                <select className="input-el" name="gender" value={form.gender} onChange={handleChange}>
                  {GENDER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </F>
              <F label="Tipo de sangre">
                <select className="input-el" name="blood_type" value={form.blood_type} onChange={handleChange}>
                  {BLOOD_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </F>
              <F label="CURP" error={errors.curp} className="form-field--full">
                <input className="input-el" name="curp" value={form.curp}
                  onChange={e => set('curp', e.target.value.toUpperCase())}
                  placeholder="18 caracteres" maxLength={18} />
              </F>
            </div>
          )}

          {/* ── TAB: CONTACTO / ACOMPAÑANTE ── */}
          {tab === 'contacto' && (
            <div className="form-grid">
              {!isMinor ? (
                <>
                  <F label="Teléfono">
                    <input className="input-el" name="phone" value={form.phone} onChange={handleChange} placeholder="10 dígitos" type="tel" />
                  </F>
                  <F label="Correo electrónico" error={errors.email}>
                    <input className="input-el" name="email" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" type="email" />
                  </F>
                </>
              ) : (
                <>
                  <div className="form-field form-field--full" style={{ marginBottom: '0.25rem' }}>
                    <div style={{ background: '#FEF3C7', border: '0.5px solid #F5C97A', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.83rem', color: '#7A5000', lineHeight: 1.5 }}>
                      ⚠️ El paciente es menor de edad. Ingresa los datos del padre, madre o tutor legal.
                    </div>
                  </div>
                  <F label="Nombre(s) del acompañante" required error={errors.companion_first_name}>
                    <input className="input-el" name="companion_first_name" value={form.companion_first_name} onChange={handleChange} />
                  </F>
                  <F label="Apellido paterno" required error={errors.companion_last_name}>
                    <input className="input-el" name="companion_last_name" value={form.companion_last_name} onChange={handleChange} />
                  </F>
                  <F label="Apellido materno">
                    <input className="input-el" name="companion_last_name_maternal" value={form.companion_last_name_maternal} onChange={handleChange} />
                  </F>
                  <F label="Relación con el paciente" required error={errors.companion_relationship}>
                    <select className="input-el" name="companion_relationship" value={form.companion_relationship} onChange={handleChange}>
                      {RELATIONSHIP_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </F>
                  <F label="Fecha de nacimiento del acompañante">
                    <input type="date" className="input-el" name="companion_dob" value={form.companion_dob} onChange={handleChange} />
                  </F>
                  <F label="Teléfono del acompañante">
                    <input className="input-el" name="companion_phone" value={form.companion_phone} onChange={handleChange} placeholder="10 dígitos" type="tel" />
                  </F>
                  <F label="Correo del acompañante" error={errors.email}>
                    <input className="input-el" name="companion_email" value={form.companion_email} onChange={handleChange} placeholder="correo@ejemplo.com" type="email" />
                  </F>
                </>
              )}
            </div>
          )}

          {/* ── TAB: INFORMACIÓN ADICIONAL ── */}
          {tab === 'adicional' && (
            <div className="form-grid">
              <F label="Dirección (calle y número)" className="form-field--full">
                <input className="input-el" name="address" value={form.address} onChange={handleChange} placeholder="Ej. Av. Constitución 1234 Int. 5" />
              </F>
              <F label="Colonia">
                <input className="input-el" name="colonia" value={form.colonia} onChange={handleChange} />
              </F>
              <F label="Ciudad">
                <input className="input-el" name="ciudad" value={form.ciudad} onChange={handleChange} />
              </F>
              <F label="Estado">
                <input className="input-el" name="estado" value={form.estado} onChange={handleChange} />
              </F>
              <F label="Código postal">
                <input className="input-el" name="codigo_postal" value={form.codigo_postal} onChange={handleChange} maxLength={5} />
              </F>
              <F label="Estado civil">
                <select className="input-el" name="estado_civil" value={form.estado_civil} onChange={handleChange}>
                  {ESTADO_CIVIL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </F>
              <F label="Ocupación">
                <input className="input-el" name="ocupacion" value={form.ocupacion} onChange={handleChange} placeholder="Ej. Ingeniero, Ama de casa..." />
              </F>
            </div>
          )}

          {/* ── TAB: DATOS MÉDICOS ── */}
          {tab === 'medico' && (
            <div className="form-grid">
              <F label="Alergias" className="form-field--full">
                <textarea className="textarea-el" name="allergies" value={form.allergies} onChange={handleChange}
                  placeholder="Medicamentos, alimentos, materiales (látex, polvo, etc.)" rows={3} />
              </F>
              <F label="Notas clínicas / Antecedentes" className="form-field--full">
                <textarea className="textarea-el" name="notes" value={form.notes} onChange={handleChange}
                  placeholder="Enfermedades crónicas, cirugías previas, medicamentos actuales..." rows={4} />
              </F>

              {/* Aviso de privacidad */}
              <div className="form-field form-field--full">
                <div style={{ background: errors.privacy ? 'var(--error-soft)' : 'var(--cream)', border: `1px solid ${errors.privacy ? '#fecaca' : 'var(--border)'}`, borderRadius: 10, padding: '1rem 1.1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
                    <input type="checkbox" name="privacy_accepted" checked={form.privacy_accepted} onChange={handleChange}
                      style={{ accentColor: 'var(--forest-mid)', width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '0.83rem', color: 'var(--text)', lineHeight: 1.6 }}>
                      <strong>Aviso de privacidad: </strong>
                      Acepto que mis datos personales sean tratados conforme al aviso de privacidad de esta institución médica, de acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). <strong style={{ color: 'var(--error)' }}>*</strong>
                    </span>
                  </label>
                  {errors.privacy && <p style={{ fontSize: '0.78rem', color: 'var(--error)', marginTop: '0.5rem', marginLeft: '1.5rem' }}>{errors.privacy}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            {tab !== 'personal' && (
              <Button variant="ghost" onClick={() => {
                const idx = TABS.findIndex(t => t.id === tab);
                setTab(TABS[idx - 1].id);
              }}>← Anterior</Button>
            )}
            {tab !== 'medico' && (
              <Button variant="secondary" onClick={() => {
                const idx = TABS.findIndex(t => t.id === tab);
                setTab(TABS[idx + 1].id);
              }}>Siguiente →</Button>
            )}
          </div>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.privacy_accepted}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar paciente'}
          </Button>
        </div>

      </div>
    </div>
  );
}

// ─── Helper de campo ─────────────────────────────────────────
function F({ label, required, error, children, className = '' }) {
  return (
    <div className={`form-field ${className}`}>
      <label className="input-label">
        {label}{required && <span style={{ color: 'var(--error)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: 2 }}>{error}</span>}
    </div>
  );
}
