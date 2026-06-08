import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import '../styles/patient_page.css';

// ── Catálogos ─────────────────────────────────────────────────
const COMMON_VACCINES = [
  'BCG','Hepatitis B','Pentavalente (DPaT+VIP+Hib)','Neumocócica conjugada 13v',
  'Rotavirus','Influenza','SRP (Triple viral)','Varicela','VPH (Papiloma humano)',
  'Hepatitis A','DPaT (refuerzo)','Tdap (adulto)','Covid-19','Meningocócica',
  'Fiebre tifoidea','Otra',
];

const FILE_TYPES = [
  { value: 'lab',        label: '🧪 Laboratorio' },
  { value: 'imaging',    label: '🫁 Imagen (Rx, TAC, USG)' },
  { value: 'prescription', label: '💊 Receta' },
  { value: 'referral',   label: '📋 Referencia' },
  { value: 'document',   label: '📄 Documento general' },
];

const REPORT_TYPES = [
  { value: 'health_certificate', label: 'Certificado de salud' },
  { value: 'passport_letter',    label: 'Carta para pasaporte / viaje' },
  { value: 'sick_leave',         label: 'Constancia de incapacidad' },
  { value: 'insurance_report',   label: 'Informe para aseguradora' },
  { value: 'specialist_referral',label: 'Referencia a especialista' },
  { value: 'general',            label: 'Informe médico general' },
];

const ENFERMEDADES_FAMILIARES = [
  'Diabetes mellitus','Hipertensión arterial','Cardiopatía','Cáncer',
  'Asma / Alergias','Epilepsia','Enf. renal','Artritis','Otras',
];
const FAM_MEMBERS = ['Padre','Madre','Abuelo pat.','Abuela pat.','Abuelo mat.','Abuela mat.','Hermanos'];

// ── Catálogo de alergias estructuradas ────────────────────────
const REACTION_TYPES = [
  'Anafilaxia','Urticaria','Angioedema','Broncoespasmo','Eritema / Sarpullido',
  'Rinitis','Conjuntivitis','Náuseas / Vómito','Hipotensión','Otra',
];
const SEVERITY_OPTS = [
  { value: 'leve',     label: 'Leve',     color: '#d97706' },
  { value: 'moderada', label: 'Moderada', color: '#dc2626' },
  { value: 'grave',    label: 'Grave ⚠',  color: '#7f1d1d' },
];
const EMPTY_ALLERGY = { allergen: '', reaction: '', severity: 'moderada', notes: '' };

// ── Helpers ───────────────────────────────────────────────────
function calcAge(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}
function fmtDate(d, opts) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', opts || { day: 'numeric', month: 'short', year: 'numeric' });
}
function getInitials(p) {
  return `${p?.first_name || ''} ${p?.last_name || ''}`.trim()
    .split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?';
}
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function hasAllergies(patient) {
  return !!(patient?.allergies || patient?.has_allergies);
}

// ── AllergyAlert — banner de alerta de alergias ───────────────
function AllergyAlert({ patient, historia }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  // Construir lista de alergias: texto libre + estructuradas
  const textAllergy = patient?.allergies;
  const structured  = historia?.alergias_estructuradas || [];
  if (!textAllergy && structured.length === 0) return null;

  const graveSev = SEVERITY_OPTS.find(s => s.value === 'grave');

  return (
    <div className="pp-allergy-alert" role="alert">
      <div className="pp-allergy-alert__icon">⚠</div>
      <div className="pp-allergy-alert__body">
        <span className="pp-allergy-alert__title">ALERTA DE ALERGIA</span>
        {structured.length > 0 ? (
          <div className="pp-allergy-alert__list">
            {structured.map((a, i) => {
              const sev = SEVERITY_OPTS.find(s => s.value === a.severity) || SEVERITY_OPTS[1];
              return (
                <span key={i} className="pp-allergy-alert__pill"
                  style={{ borderColor: sev.color, color: sev.color }}>
                  <strong>{a.allergen}</strong>
                  {a.reaction && <> · {a.reaction}</>}
                  <em style={{ marginLeft: '0.3rem', fontSize: '0.72rem' }}>[{sev.label}]</em>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="pp-allergy-alert__text">{textAllergy}</span>
        )}
        {textAllergy && structured.length === 0 && null}
      </div>
      <button className="pp-allergy-alert__dismiss" onClick={() => setDismissed(true)}
        title="Cerrar alerta (sólo esta sesión)">✕</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function PatientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('historia');
  const [topHistoria, setTopHistoria] = useState(null); // para AllergyAlert

  useEffect(() => {
    Promise.all([
      api.get(`/api/patients/${id}`),
      api.get(`/api/patients/${id}/historia`).catch(() => ({ data: { data: null } })),
    ]).then(([rPat, rHist]) => {
      setPatient(rPat.data);
      setTopHistoria(rHist.data?.data || null);
    }).catch(() => navigate('/patients'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="nota-layout"><Sidebar />
      <div className="nota-main"><Navbar title="Paciente" />
        <div className="nota-content"><p style={{color:'var(--ink-40)',padding:'3rem 0'}}>Cargando...</p></div>
      </div>
    </div>
  );
  if (!patient) return null;

  const age      = calcAge(patient.birth_date || patient.date_of_birth);
  const isMinor  = patient.is_minor || (age !== null && age < 18);
  const fullName = patient.full_name || `${patient.first_name} ${patient.last_name || ''}`.trim();
  const canEdit  = ['admin', 'doctor', 'secretary'].includes(user?.role);

  const TABS = [
    { id: 'historia',   label: '📋 Historia clínica' },
    { id: 'consultas',  label: '🏥 Consultas' },
    ...(isMinor ? [{ id: 'crecimiento', label: '📈 Crecimiento' }] : []),
    { id: 'archivos',   label: '📁 Archivos' },
    { id: 'vacunacion', label: '💉 Vacunación' },
    { id: 'informes',   label: '📝 Informes' },
  ];

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar
          title={fullName}
          actions={
            <div style={{display:'flex',gap:'0.5rem'}}>
              <button className="pp-back-btn" onClick={() => navigate('/patients')}>← Pacientes</button>
            </div>
          }
        />
        <div className="nota-content pp-content">

          {/* ── Header del paciente ── */}
          <div className="pp-header">
            <div className="pp-avatar">{getInitials(patient)}</div>
            <div className="pp-header__info">
              <h1 className="pp-header__name">{fullName}</h1>
              <div className="pp-header__meta">
                {age !== null && <span>{age} años</span>}
                {patient.gender && <span>{patient.gender === 'masculino' ? 'Masculino' : patient.gender === 'femenino' ? 'Femenino' : patient.gender}</span>}
                {patient.blood_type && <span className="pp-blood">{patient.blood_type}</span>}
                {patient.curp && <span className="pp-mono">{patient.curp}</span>}
                {isMinor && <span className="pp-minor-badge">Paciente pediátrico</span>}
              </div>
              {patient.allergies && (
                <div className="pp-allergy">⚠ Alergias: {patient.allergies}</div>
              )}
            </div>
            {canEdit && (
              <button className="pp-edit-btn" onClick={() => navigate('/patients', { state: { editId: patient.id } })}>
                Editar datos
              </button>
            )}
          </div>

          {/* ── Alerta de alergias ── */}
          <AllergyAlert patient={patient} historia={topHistoria} />

          {/* ── Tabs ── */}
          <div className="pp-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`pp-tab${tab === t.id ? ' pp-tab--active' : ''}`}
                onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {/* ── Contenido ── */}
          {tab === 'historia'    && <HistoriaClinicaTab patientId={id} isMinor={isMinor} canEdit={canEdit} />}
          {tab === 'consultas'   && <ConsultasTab patientId={id} patient={patient} navigate={navigate} />}
          {tab === 'crecimiento' && <CrecimientoTab patientId={id} patient={patient} />}
          {tab === 'archivos'    && <ArchivosTab patientId={id} canEdit={canEdit} />}
          {tab === 'vacunacion'  && <VacunacionTab patientId={id} canEdit={canEdit} />}
          {tab === 'informes'    && <InformesTab patientId={id} patient={patient} canEdit={canEdit} />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// EDITOR ESTRUCTURADO DE ALERGIAS
// ══════════════════════════════════════════════════════════════
function AllergiasEditor({ h, update, canEdit }) {
  const list = h.alergias_estructuradas || [];

  function addRow() {
    update({ alergias_estructuradas: [...list, { ...EMPTY_ALLERGY }] });
  }
  function removeRow(i) {
    const next = list.filter((_, idx) => idx !== i);
    update({ alergias_estructuradas: next });
  }
  function editRow(i, field, val) {
    const next = list.map((row, idx) => idx === i ? { ...row, [field]: val } : row);
    update({ alergias_estructuradas: next });
  }

  const SEV_COLORS = { leve: '#d97706', moderada: '#dc2626', grave: '#7f1d1d' };

  return (
    <div>
      {/* ── Tabla estructurada ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
          <h4 style={{ margin:0, fontSize:'0.9rem', fontWeight:600, color:'var(--ink)' }}>
            Registro de alergias
          </h4>
          {canEdit && (
            <button className="exp-add-rx-btn" onClick={addRow}>+ Agregar alergia</button>
          )}
        </div>

        {list.length === 0 ? (
          <p className="pp-hint" style={{ padding:'1.25rem', textAlign:'center', background:'var(--forest-bg)', borderRadius:'var(--radius-lg)' }}>
            Sin alergias registradas.{canEdit ? ' Haz clic en "+ Agregar alergia" para iniciar.' : ''}
          </p>
        ) : (
          <div className="pp-allergy-table-wrap">
            <table className="pp-allergy-table">
              <thead>
                <tr>
                  <th>Alérgeno / Sustancia</th>
                  <th>Tipo de reacción</th>
                  <th>Severidad</th>
                  <th>Notas</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((row, i) => {
                  const sevColor = SEV_COLORS[row.severity] || '#dc2626';
                  return (
                    <tr key={i}>
                      <td>
                        {canEdit
                          ? <input className="config-input" value={row.allergen}
                              placeholder="Ej. Penicilina, mariscos, látex..."
                              onChange={e => editRow(i, 'allergen', e.target.value)} />
                          : <strong>{row.allergen || '—'}</strong>}
                      </td>
                      <td>
                        {canEdit
                          ? (
                            <div className="config-select-wrap">
                              <select className="config-select" value={row.reaction}
                                onChange={e => editRow(i, 'reaction', e.target.value)}>
                                <option value="">Selecciona...</option>
                                {REACTION_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                          )
                          : <span>{row.reaction || '—'}</span>}
                      </td>
                      <td>
                        {canEdit
                          ? (
                            <div className="config-select-wrap">
                              <select className="config-select" value={row.severity}
                                style={{ color: sevColor, fontWeight: 600 }}
                                onChange={e => editRow(i, 'severity', e.target.value)}>
                                {SEVERITY_OPTS.map(s =>
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                )}
                              </select>
                            </div>
                          )
                          : (
                            <span className="pp-sev-badge"
                              style={{ background: sevColor + '18', color: sevColor, borderColor: sevColor + '40' }}>
                              {SEVERITY_OPTS.find(s => s.value === row.severity)?.label || row.severity}
                            </span>
                          )}
                      </td>
                      <td>
                        {canEdit
                          ? <input className="config-input" value={row.notes}
                              placeholder="Observaciones adicionales..."
                              onChange={e => editRow(i, 'notes', e.target.value)} />
                          : <span style={{ fontSize:'0.82rem', color:'var(--ink-60)' }}>{row.notes || '—'}</span>}
                      </td>
                      {canEdit && (
                        <td>
                          <button onClick={() => removeRow(i)}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-40)', fontSize:'1rem', padding:'0.25rem 0.4rem', borderRadius:4 }}
                            title="Eliminar">✕</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Observaciones ── */}
      <HField label="Observaciones generales" full>
        <PPTextarea value={h.observaciones||''} onChange={v=>update({observaciones:v})} disabled={!canEdit}
          placeholder="Cualquier dato relevante para el expediente clínico..." rows={4} />
      </HField>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HISTORIA CLÍNICA
// ══════════════════════════════════════════════════════════════
function HistoriaClinicaTab({ patientId, isMinor, canEdit }) {
  const [historia, setHistoria] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [section, setSection]   = useState(isMinor ? 'pediatrico' : 'familiares');
  const [saveState, setSaveState] = useState('idle');
  const timer = useRef(null);

  useEffect(() => {
    api.get(`/api/patients/${patientId}/historia`)
      .then(r => setHistoria(r.data.data || {}))
      .catch(() => setHistoria({}))
      .finally(() => setLoading(false));
    return () => clearTimeout(timer.current);
  }, [patientId]);

  const autosave = useCallback((updated) => {
    clearTimeout(timer.current);
    setSaveState('idle');
    timer.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await api.put(`/api/patients/${patientId}/historia`, updated);
        setHistoria(res.data.data);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch { setSaveState('error'); }
    }, 1500);
  }, [patientId]);

  function update(patch) {
    setHistoria(prev => {
      const next = { ...prev, ...patch };
      autosave(next);
      return next;
    });
  }

  function updateFam(enfermedad, miembro, checked) {
    setHistoria(prev => {
      const fam = { ...(prev.antecedentes_familiares || {}) };
      if (!fam[enfermedad]) fam[enfermedad] = [];
      if (checked) fam[enfermedad] = [...new Set([...fam[enfermedad], miembro])];
      else fam[enfermedad] = fam[enfermedad].filter(m => m !== miembro);
      const next = { ...prev, antecedentes_familiares: fam };
      autosave(next);
      return next;
    });
  }

  if (loading) return <p className="pp-loading">Cargando historia clínica...</p>;

  const h = historia || {};
  const SECTIONS = [
    ...(isMinor ? [{ id:'pediatrico', label:'👶 Pediátrico' }] : []),
    { id:'familiares',    label:'👪 Familiares' },
    { id:'patologicos',   label:'🏥 Patológicos' },
    { id:'no_patologicos',label:'🌿 No patológicos' },
    { id:'alergias',      label:'⚠ Alergias y observaciones' },
  ];

  return (
    <div className="pp-section-wrap">
      <div className="pp-sub-nav">
        {SECTIONS.map(s => (
          <button key={s.id} className={`pp-sub-tab${section === s.id ? ' pp-sub-tab--active' : ''}`}
            onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
        <span className={`pp-save-ind pp-save--${saveState}`}>
          {saveState === 'saving' ? 'Guardando...' : saveState === 'saved' ? '✓ Guardado' : saveState === 'error' ? '✕ Error' : ''}
        </span>
      </div>

      {/* ── PEDIÁTRICO ── */}
      {section === 'pediatrico' && (
        <div className="pp-form-grid">
          <HField label="Tipo de parto">
            <PPSelect value={h.tipo_parto||''} onChange={v=>update({tipo_parto:v})} disabled={!canEdit}>
              <option value="">—</option>
              <option>Eutócico (normal)</option>
              <option>Cesárea programada</option>
              <option>Cesárea de urgencia</option>
              <option>Parto instrumentado</option>
              <option>Pretérmino</option>
            </PPSelect>
          </HField>
          <HField label="Semanas de gestación">
            <PPInput type="number" min={22} max={44} value={h.semanas_gestacion||''} onChange={v=>update({semanas_gestacion:v})} disabled={!canEdit} placeholder="Ej. 38" />
          </HField>
          <HField label="Peso al nacer (kg)">
            <PPInput type="number" step="0.01" value={h.peso_nacer||''} onChange={v=>update({peso_nacer:v})} disabled={!canEdit} placeholder="Ej. 3.2" />
          </HField>
          <HField label="Talla al nacer (cm)">
            <PPInput type="number" step="0.5" value={h.talla_nacer||''} onChange={v=>update({talla_nacer:v})} disabled={!canEdit} placeholder="Ej. 50" />
          </HField>
          <HField label="Perímetro cefálico (cm)">
            <PPInput type="number" step="0.5" value={h.perimetro_cefalico||''} onChange={v=>update({perimetro_cefalico:v})} disabled={!canEdit} placeholder="Ej. 34" />
          </HField>
          <HField label="Lactancia materna">
            <PPSelect value={h.lactancia_materna===true?'si':h.lactancia_materna===false?'no':''} onChange={v=>update({lactancia_materna: v==='si'})} disabled={!canEdit}>
              <option value="">—</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </PPSelect>
          </HField>
          {h.lactancia_materna && (
            <HField label="Duración de lactancia">
              <PPInput value={h.lactancia_duracion||''} onChange={v=>update({lactancia_duracion:v})} disabled={!canEdit} placeholder="Ej. 6 meses" />
            </HField>
          )}
          <HField label="Desarrollo psicomotor">
            <PPSelect value={h.desarrollo_psicomotor||'normal'} onChange={v=>update({desarrollo_psicomotor:v})} disabled={!canEdit}>
              <option value="normal">Normal</option>
              <option value="retraso_leve">Retraso leve</option>
              <option value="retraso_moderado">Retraso moderado</option>
              <option value="retraso_severo">Retraso severo</option>
            </PPSelect>
          </HField>
          <HField label="Complicaciones perinatales" full>
            <PPTextarea value={h.complicaciones_perinatales||''} onChange={v=>update({complicaciones_perinatales:v})} disabled={!canEdit} placeholder="Describe complicaciones si las hubo..." rows={3} />
          </HField>
          <HField label="Notas de desarrollo" full>
            <PPTextarea value={h.desarrollo_notas||''} onChange={v=>update({desarrollo_notas:v})} disabled={!canEdit} placeholder="Observaciones sobre el desarrollo..." rows={3} />
          </HField>
        </div>
      )}

      {/* ── FAMILIARES ── */}
      {section === 'familiares' && (
        <div>
          <p className="pp-hint">Marca los familiares con antecedentes de cada enfermedad.</p>
          <div className="pp-fam-table-wrap">
            <table className="pp-fam-table">
              <thead>
                <tr>
                  <th>Enfermedad</th>
                  {FAM_MEMBERS.map(m => <th key={m}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {ENFERMEDADES_FAMILIARES.map(enf => (
                  <tr key={enf}>
                    <td>{enf}</td>
                    {FAM_MEMBERS.map(m => (
                      <td key={m} className="pp-fam-cell">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={(h.antecedentes_familiares?.[enf] || []).includes(m)}
                          onChange={e => updateFam(enf, m, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <HField label="Notas adicionales de antecedentes familiares" full style={{marginTop:'1rem'}}>
            <PPTextarea
              value={(h.antecedentes_familiares?.notas)||''}
              onChange={v => {
                const fam = {...(h.antecedentes_familiares||{}), notas: v};
                update({antecedentes_familiares: fam});
              }}
              disabled={!canEdit} placeholder="Observaciones generales..." rows={3} />
          </HField>
        </div>
      )}

      {/* ── PATOLÓGICOS ── */}
      {section === 'patologicos' && (
        <div className="pp-form-grid">
          <HField label="Enfermedades crónicas previas" full>
            <PPTextarea value={h.enfermedades_previas||''} onChange={v=>update({enfermedades_previas:v})} disabled={!canEdit}
              placeholder="Ej. Asma bronquial desde los 5 años, DM2 dx 2018..." rows={4} />
          </HField>
          <HField label="Cirugías" full>
            <PPTextarea value={h.cirugias||''} onChange={v=>update({cirugias:v})} disabled={!canEdit}
              placeholder="Ej. Apendicectomía 2015, colecistectomía laparoscópica 2020..." rows={3} />
          </HField>
          <HField label="Hospitalizaciones" full>
            <PPTextarea value={h.hospitalizaciones||''} onChange={v=>update({hospitalizaciones:v})} disabled={!canEdit}
              placeholder="Motivo, duración y fecha aproximada..." rows={3} />
          </HField>
          <HField label="Traumatismos / Fracturas" full>
            <PPTextarea value={h.traumatismos||''} onChange={v=>update({traumatismos:v})} disabled={!canEdit}
              placeholder="Tipo y fecha aproximada..." rows={2} />
          </HField>
          <HField label="Alergias a medicamentos" full>
            <PPTextarea value={h.alergias_medicamentos||''} onChange={v=>update({alergias_medicamentos:v})} disabled={!canEdit}
              placeholder="Ej. Penicilina (urticaria), AINEs (broncoespasmo)..." rows={2} />
          </HField>
          <HField label="Transfusiones sanguíneas">
            <PPSelect value={h.transfusiones?'si':'no'} onChange={v=>update({transfusiones:v==='si'})} disabled={!canEdit}>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </PPSelect>
          </HField>
        </div>
      )}

      {/* ── NO PATOLÓGICOS ── */}
      {section === 'no_patologicos' && (
        <div className="pp-form-grid">
          <HField label="Tabaquismo">
            <PPSelect value={h.tabaquismo||'no'} onChange={v=>update({tabaquismo:v})} disabled={!canEdit}>
              <option value="no">No</option>
              <option value="exfumador">Exfumador</option>
              <option value="activo">Fumador activo</option>
            </PPSelect>
          </HField>
          {h.tabaquismo && h.tabaquismo !== 'no' && (
            <HField label="Tabaquismo — detalles">
              <PPInput value={h.tabaquismo_detalles||''} onChange={v=>update({tabaquismo_detalles:v})} disabled={!canEdit}
                placeholder="Ej. 5 cigarros/día, 10 años" />
            </HField>
          )}
          <HField label="Alcoholismo">
            <PPSelect value={h.alcoholismo||'no'} onChange={v=>update({alcoholismo:v})} disabled={!canEdit}>
              <option value="no">No</option>
              <option value="ocasional">Ocasional</option>
              <option value="habitual">Habitual</option>
              <option value="dependencia">Dependencia</option>
            </PPSelect>
          </HField>
          {h.alcoholismo && h.alcoholismo !== 'no' && (
            <HField label="Alcoholismo — detalles">
              <PPInput value={h.alcoholismo_detalles||''} onChange={v=>update({alcoholismo_detalles:v})} disabled={!canEdit}
                placeholder="Frecuencia y cantidad" />
            </HField>
          )}
          <HField label="Otras sustancias">
            <PPSelect value={h.drogas||'no'} onChange={v=>update({drogas:v})} disabled={!canEdit}>
              <option value="no">No</option>
              <option value="si">Sí (especificar)</option>
            </PPSelect>
          </HField>
          {h.drogas === 'si' && (
            <HField label="Sustancias — detalles">
              <PPInput value={h.drogas_detalles||''} onChange={v=>update({drogas_detalles:v})} disabled={!canEdit}
                placeholder="Tipo, frecuencia..." />
            </HField>
          )}
          <HField label="Actividad física">
            <PPSelect value={h.actividad_fisica||''} onChange={v=>update({actividad_fisica:v})} disabled={!canEdit}>
              <option value="">—</option>
              <option value="sedentario">Sedentario</option>
              <option value="leve">Actividad leve (1–2 días/sem)</option>
              <option value="moderada">Moderada (3–4 días/sem)</option>
              <option value="intensa">Intensa (5+ días/sem)</option>
            </PPSelect>
          </HField>
          <HField label="Alimentación" full>
            <PPTextarea value={h.alimentacion||''} onChange={v=>update({alimentacion:v})} disabled={!canEdit}
              placeholder="Tipo de dieta, número de comidas al día, restricciones..." rows={3} />
          </HField>
        </div>
      )}

      {/* ── ALERGIAS Y OBSERVACIONES ── */}
      {section === 'alergias' && (
        <AllergiasEditor h={h} update={update} canEdit={canEdit} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CONSULTAS
// ══════════════════════════════════════════════════════════════
function ConsultasTab({ patientId, patient, navigate }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/appointments')
      .then(r => {
        const all = r.data?.appointments || r.data || [];
        setAppointments(all.filter(a => a.patient_id === patientId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  const STATUS_LABEL = {
    scheduled: { label: 'Programada',     cls: 'hist-badge--blue'   },
    confirmed: { label: 'Confirmada',     cls: 'hist-badge--teal'   },
    completed: { label: 'Completada',     cls: 'hist-badge--green'  },
    cancelled: { label: 'Cancelada',      cls: 'hist-badge--red'    },
    no_show:   { label: 'No se presentó', cls: 'hist-badge--yellow' },
    waiting:   { label: 'En sala',        cls: 'hist-badge--orange' },
  };

  if (loading) return <p className="pp-loading">Cargando consultas...</p>;

  return (
    <div>
      {appointments.length === 0 ? (
        <div className="pp-empty"><div className="pp-empty__icon">🏥</div><p>Sin consultas registradas.</p></div>
      ) : (
        <div className="pp-consults-list">
          {appointments.map(a => {
            const badge = STATUS_LABEL[a.status] || { label: a.status, cls: '' };
            return (
              <div key={a.id} className="pp-consult-card">
                <div className="pp-consult-card__date">
                  <span className="pp-consult-card__day">{fmtDate(a.appointment_date, {day:'numeric',month:'short'})}</span>
                  <span className="pp-consult-card__year">{a.appointment_date?.split('-')[0]}</span>
                </div>
                <div className="pp-consult-card__body">
                  <div className="pp-consult-card__top">
                    <span className="pp-consult-card__doctor">{a.doctor_name || '—'}</span>
                    {a.start_time && <span className="pp-consult-card__time">{a.start_time.slice(0,5)}</span>}
                    <span className={`hist-badge ${badge.cls}`}>{badge.label}</span>
                    {a.visit_type && (
                      <span className="pp-visit-type">{a.visit_type === 'primera_vez' ? 'Primera vez' : 'Subsecuente'}</span>
                    )}
                  </div>
                  {a.reason && <p className="pp-consult-card__reason">{a.reason}</p>}
                </div>
                {a.status === 'completed' && (
                  <button className="pp-note-link" onClick={() => navigate(`/clinical-notes/${a.id}`)}>
                    Ver nota →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CRECIMIENTO
// ══════════════════════════════════════════════════════════════
function CrecimientoTab({ patientId, patient }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('peso');

  useEffect(() => {
    api.get(`/api/patients/${patientId}/growth`)
      .then(r => setData(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <p className="pp-loading">Cargando mediciones...</p>;

  const dob = patient.birth_date || patient.date_of_birth;

  return (
    <div>
      <div style={{display:'flex',gap:'0.5rem',marginBottom:'1.25rem'}}>
        {[{id:'peso',label:'Peso (kg)'},{id:'talla',label:'Talla (cm)'},{id:'imc',label:'IMC'}].map(v => (
          <button key={v.id} className={`est-quick-btn${view===v.id?' est-quick-btn--active':''}`}
            onClick={() => setView(v.id)}>{v.label}</button>
        ))}
      </div>

      {data.length < 2 ? (
        <div className="pp-empty">
          <div className="pp-empty__icon">📈</div>
          <p>Se necesitan al menos 2 consultas con signos vitales registrados para mostrar la gráfica.</p>
          <p style={{fontSize:'0.82rem',color:'var(--ink-40)',marginTop:'0.35rem'}}>
            Los datos se toman automáticamente de los signos vitales de cada nota clínica.
          </p>
        </div>
      ) : (
        <>
          <GrowthChart
            data={data}
            field={view === 'peso' ? 'peso_kg' : view === 'talla' ? 'talla_cm' : 'imc'}
            label={view === 'peso' ? 'Peso' : view === 'talla' ? 'Talla' : 'IMC'}
            unit={view === 'peso' ? 'kg' : view === 'talla' ? 'cm' : 'kg/m²'}
            color={view === 'peso' ? '#2D5A3D' : view === 'talla' ? '#1d4ed8' : '#9333ea'}
          />
          <div className="pp-growth-table">
            <table className="est-table" style={{marginTop:'1.5rem'}}>
              <thead>
                <tr><th>Fecha</th><th>Peso (kg)</th><th>Talla (cm)</th><th>IMC</th></tr>
              </thead>
              <tbody>
                {[...data].reverse().map((d, i) => (
                  <tr key={i}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.8rem',color:'var(--ink-40)'}}>{fmtDate(d.date)}</td>
                    <td>{d.peso_kg ?? '—'}</td>
                    <td>{d.talla_cm ?? '—'}</td>
                    <td>{d.imc ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function GrowthChart({ data, field, label, unit, color }) {
  const vals = data.map(d => d[field]).filter(v => v !== null && !isNaN(v));
  if (vals.length === 0) return <p className="pp-empty-inline">Sin datos de {label}.</p>;

  const W = 700, H = 220;
  const PAD = { top: 20, right: 24, bottom: 44, left: 54 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const minV = Math.min(...vals) * 0.93;
  const maxV = Math.max(...vals) * 1.07;
  const range = maxV - minV || 1;

  const pts = data
    .map((d, i) => ({ ...d, v: parseFloat(d[field]) }))
    .filter(d => !isNaN(d.v))
    .map((d, i, arr) => ({
      ...d,
      x: PAD.left + (arr.length === 1 ? cW / 2 : (i / (arr.length - 1)) * cW),
      y: PAD.top + cH - ((d.v - minV) / range) * cH,
    }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const ticks = 4;

  return (
    <div className="pp-growth-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="pp-growth-svg">
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const t  = i / ticks;
          const y  = PAD.top + t * cH;
          const v  = maxV - t * range;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke={i === ticks ? 'var(--border)' : '#e5e7eb'} strokeWidth={i === ticks ? 1.5 : 1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + cH} stroke="var(--border)" strokeWidth={1.5} />

        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">
              {p.date?.slice(2, 7)}
            </text>
          </g>
        ))}
      </svg>
      <div className="pp-growth-legend">
        <span style={{background:color,width:12,height:12,borderRadius:'50%',display:'inline-block'}} />
        {label} ({unit})
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ARCHIVOS
// ══════════════════════════════════════════════════════════════
function ArchivosTab({ patientId, canEdit }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ file_type: 'lab', description: '', file_date: '' });
  const fileRef = useRef(null);

  useEffect(() => {
    api.get(`/api/patients/${patientId}/files`)
      .then(r => setFiles(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('file_type', form.file_type);
      if (form.description) fd.append('description', form.description);
      if (form.file_date)    fd.append('file_date', form.file_date);
      const res = await api.post(`/api/patients/${patientId}/files`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      setFiles(prev => [res.data.data, ...prev]);
      setForm({ file_type: 'lab', description: '', file_date: '' });
    } catch { /* show nothing, upload failed */ }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este archivo?')) return;
    await api.delete(`/api/patients/${patientId}/files/${id}`);
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  const FILE_ICONS = { lab: '🧪', imaging: '🫁', prescription: '💊', referral: '📋', document: '📄' };

  if (loading) return <p className="pp-loading">Cargando archivos...</p>;

  return (
    <div>
      {canEdit && (
        <div className="pp-upload-bar">
          <div className="config-select-wrap" style={{flex:'0 0 180px'}}>
            <select className="config-select" value={form.file_type}
              onChange={e => setForm(p => ({ ...p, file_type: e.target.value }))}>
              {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <input className="exp-text-input" style={{flex:1}} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Descripción (opcional)" />
          <input type="date" className="est-date-input" value={form.file_date}
            onChange={e => setForm(p => ({ ...p, file_date: e.target.value }))} />
          <button className="doc-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : '↑ Subir archivo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx"
            style={{display:'none'}} onChange={handleUpload} />
        </div>
      )}

      {files.length === 0 ? (
        <div className="pp-empty"><div className="pp-empty__icon">📁</div><p>Sin archivos registrados.</p></div>
      ) : (
        <div className="pp-files-list">
          {files.map(f => (
            <div key={f.id} className="pp-file-card">
              <div className="pp-file-card__icon">{FILE_ICONS[f.file_type] || '📄'}</div>
              <div className="pp-file-card__info">
                <span className="pp-file-card__name">{f.name}</span>
                <div className="pp-file-card__meta">
                  {f.file_type && <span>{FILE_TYPES.find(t=>t.value===f.file_type)?.label || f.file_type}</span>}
                  {f.file_date && <span>{fmtDate(f.file_date)}</span>}
                  {f.size_bytes && <span>{fmtBytes(f.size_bytes)}</span>}
                </div>
                {f.description && <p className="pp-file-card__desc">{f.description}</p>}
              </div>
              <div className="pp-file-card__actions">
                <a href={f.file_url} target="_blank" rel="noreferrer" className="pp-file-link">Ver</a>
                {canEdit && (
                  <button className="pp-file-del" onClick={() => handleDelete(f.id)}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VACUNACIÓN — Esquema de cuadricula
// ══════════════════════════════════════════════════════════════

// Columnas de edad
const AGE_COLS = [
  { id:'rn',    label:'Al nacer' },
  { id:'m2',    label:'2 meses' },
  { id:'m4',    label:'4 meses' },
  { id:'m6',    label:'6 meses' },
  { id:'m7',    label:'7 meses' },
  { id:'m12',   label:'12 meses' },
  { id:'m18',   label:'18 meses' },
  { id:'a4',    label:'4 anos' },
  { id:'a6',    label:'6 anos' },
  { id:'a912',  label:'9-12 anos' },
  { id:'anual', label:'Anual' },
];

// Grupos de vacunas con sus celdas aplicables
const VACCINE_GROUPS = [
  {
    id:'mx', label:'Cartilla Nacional de Vacunacion — Mexico', color:'#2D5A3D',
    vaccines:[
      { name:'BCG (tuberculosis)',
        cells:[{col:'rn',   dose:'Unica'}] },
      { name:'Hepatitis B',
        cells:[{col:'rn',   dose:'1a dosis'},{col:'m2',dose:'2a dosis'},{col:'m6',dose:'3a dosis'}] },
      { name:'Pentavalente (DPaT+VIP+Hib)',
        cells:[{col:'m2',   dose:'1a dosis'},{col:'m4',dose:'2a dosis'},{col:'m6',dose:'3a dosis'},{col:'m18',dose:'Refuerzo'}] },
      { name:'Neumocoica conjugada 13v',
        cells:[{col:'m2',   dose:'1a dosis'},{col:'m4',dose:'2a dosis'},{col:'m12',dose:'Refuerzo'}] },
      { name:'Rotavirus',
        cells:[{col:'m2',   dose:'1a dosis'},{col:'m4',dose:'2a dosis'}] },
      { name:'Influenza',
        cells:[{col:'m6',   dose:'1a dosis (1er ano)'},{col:'m7',dose:'2a dosis (1er ano)'},{col:'anual',dose:'Anual'}] },
      { name:'SRP (Triple viral)',
        cells:[{col:'m12',  dose:'1a dosis'},{col:'a6',dose:'2a dosis'}] },
      { name:'Varicela',
        cells:[{col:'m12',  dose:'1a dosis'},{col:'a6',dose:'2a dosis'}] },
      { name:'Hepatitis A',
        cells:[{col:'m12',  dose:'1a dosis'},{col:'m18',dose:'2a dosis'}] },
      { name:'DPT (4 refuerzo)',
        cells:[{col:'a4',   dose:'Refuerzo'}] },
      { name:'VPH 1a dosis',
        cells:[{col:'a912', dose:'1a dosis'}] },
      { name:'VPH 2a dosis (+6 meses)',
        cells:[{col:'a912', dose:'2a dosis'}] },
    ],
  },
  {
    id:'cdc', label:'Vacunas adicionales (CDC / Sector privado)', color:'#1e40af',
    vaccines:[
      { name:'RSV (Nirsevimab)',
        cells:[{col:'rn',   dose:'Unica'}] },
      { name:'Polio IPV (independiente)',
        cells:[{col:'m2',   dose:'1a dosis'},{col:'m4',dose:'2a dosis'},{col:'m6',dose:'3a dosis'},{col:'a4',dose:'4a dosis'}] },
      { name:'Hib (independiente)',
        cells:[{col:'m2',   dose:'1a dosis'},{col:'m4',dose:'2a dosis'},{col:'m6',dose:'3a dosis'},{col:'m12',dose:'Refuerzo'}] },
      { name:'DTaP (independiente)',
        cells:[{col:'m2',   dose:'1a dosis'},{col:'m4',dose:'2a dosis'},{col:'m6',dose:'3a dosis'},{col:'m18',dose:'4a dosis'},{col:'a4',dose:'5a dosis'}] },
      { name:'COVID-19',
        cells:[{col:'m6',   dose:'Primovacunacion'},{col:'anual',dose:'Anual'}] },
      { name:'Meningococica',
        cells:[{col:'a912', dose:'1a dosis'}] },
      { name:'Tdap (adolescentes)',
        cells:[{col:'a912', dose:'Refuerzo'}] },
    ],
  },
];

// Clave unica para cada celda del grid
function gridCellKey(vaccineName, colId, dose) {
  return `${vaccineName}||${colId}||${dose}`;
}

const EMPTY_VAC = { vaccine_name:'', dose:'', folio:'', lot_number:'', brand:'', expiry_date:'', applied_date:'', applied_by:'', notes:'' };

function VacunacionTab({ patientId, canEdit }) {
  const [view, setView]               = useState('grid');
  const [vaccinations, setVaccinations] = useState([]);
  const [gridData, setGridData]       = useState({}); // { key: { applied_date, lot_number, expiry_date, id } }
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ ...EMPTY_VAC });
  const [editId, setEditId]           = useState(null);
  const [saving, setSaving]           = useState(false);

  useEffect(() => { loadVaccinations(); }, [patientId]);

  async function loadVaccinations() {
    try {
      const r = await api.get(`/api/patients/${patientId}/vaccinations`);
      const list = r.data.data || [];
      setVaccinations(list);
      // Mapear al grid
      const gd = {};
      list.forEach(v => {
        for (const grp of VACCINE_GROUPS) {
          for (const vac of grp.vaccines) {
            if (vac.name === v.vaccine_name) {
              const cell = vac.cells.find(c => c.dose === v.dose);
              if (cell) {
                const key = gridCellKey(vac.name, cell.col, cell.dose);
                gd[key] = { applied_date: v.applied_date||'', lot_number: v.lot_number||'', expiry_date: v.expiry_date||'', id: v.id };
              }
            }
          }
        }
      });
      setGridData(gd);
    } catch (e) { /* no-op */ }
    finally { setLoading(false); }
  }

  function updateGridCell(key, field, value) {
    setGridData(prev => ({ ...prev, [key]: { ...(prev[key]||{}), [field]: value } }));
  }

  async function saveGridCell(key, vaccineName, dose) {
    const cell = gridData[key] || {};
    if (!cell.applied_date && !cell.lot_number && !cell.expiry_date) return;
    const payload = {
      vaccine_name: vaccineName, dose,
      applied_date: cell.applied_date || null,
      lot_number:   cell.lot_number   || null,
      expiry_date:  cell.expiry_date  || null,
    };
    try {
      if (cell.id) {
        await api.put(`/api/patients/${patientId}/vaccinations/${cell.id}`, payload);
      } else {
        const res = await api.post(`/api/patients/${patientId}/vaccinations`, payload);
        const newId = res.data.data?.id;
        if (newId) setGridData(prev => ({ ...prev, [key]: { ...prev[key], id: newId } }));
      }
    } catch (e) { /* no-op */ }
  }

  function openNew()  { setForm({ ...EMPTY_VAC }); setEditId(null); setShowForm(true); }
  function openEdit(v){ setForm({ ...v });          setEditId(v.id); setShowForm(true); }

  async function handleSave() {
    if (!form.vaccine_name) return;
    setSaving(true);
    try {
      if (editId) {
        const res = await api.put(`/api/patients/${patientId}/vaccinations/${editId}`, form);
        setVaccinations(prev => prev.map(v => v.id === editId ? res.data.data : v));
      } else {
        const res = await api.post(`/api/patients/${patientId}/vaccinations`, form);
        setVaccinations(prev => [...prev, res.data.data]);
      }
      setShowForm(false);
      loadVaccinations();
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este registro de vacuna?')) return;
    await api.delete(`/api/patients/${patientId}/vaccinations/${id}`);
    setVaccinations(prev => prev.filter(v => v.id !== id));
    loadVaccinations();
  }

  if (loading) return <p className="pp-loading">Cargando esquema de vacunacion...</p>;

  return (
    <div>
      {/* Controles superiores */}
      <div style={{display:'flex', gap:'0.5rem', marginBottom:'1.5rem', alignItems:'center', flexWrap:'wrap'}}>
        <div className="vacc-view-toggle">
          <button className={`vacc-view-btn${view==='grid'?' vacc-view-btn--active':''}`} onClick={()=>setView('grid')}>
            Cuadricula
          </button>
          <button className={`vacc-view-btn${view==='list'?' vacc-view-btn--active':''}`} onClick={()=>setView('list')}>
            Lista
          </button>
        </div>
        {canEdit && (
          <button className="est-quick-btn" onClick={openNew} style={{marginLeft:'auto'}}>
            + Agregar vacuna
          </button>
        )}
      </div>

      {/* Vista cuadricula */}
      {view === 'grid' && (
        <VaccineGrid
          gridData={gridData}
          canEdit={canEdit}
          updateCell={updateGridCell}
          saveCell={saveGridCell}
        />
      )}

      {/* Vista lista */}
      {view === 'list' && (
        <div>
          {vaccinations.length === 0 ? (
            <div className="pp-empty">
              <div className="pp-empty__icon">💉</div>
              <p>Sin vacunas registradas. Usa la cuadricula para registrar las del esquema oficial.</p>
            </div>
          ) : (
            <div className="est-table-wrap">
              <table className="est-table">
                <thead>
                  <tr>
                    <th>Vacuna</th><th>Dosis</th><th>Fecha aplicacion</th>
                    <th>Folio</th><th>Lote</th><th>Caducidad</th><th>Laboratorio</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {vaccinations.map(v => (
                    <tr key={v.id}>
                      <td style={{fontWeight:500}}>{v.vaccine_name}</td>
                      <td style={{color:'var(--ink-40)',fontSize:'0.82rem'}}>{v.dose||'—'}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'0.8rem'}}>{fmtDate(v.applied_date)}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'0.78rem',color:'var(--ink-40)'}}>{v.folio||'—'}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'0.78rem',color:'var(--ink-40)'}}>{v.lot_number||'—'}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'0.8rem',
                        color:v.expiry_date&&new Date(v.expiry_date)<new Date()?'var(--error)':'var(--ink-40)'}}>
                        {fmtDate(v.expiry_date)}
                      </td>
                      <td style={{color:'var(--ink-40)',fontSize:'0.82rem'}}>{v.brand||'—'}</td>
                      {canEdit && (
                        <td>
                          <div style={{display:'flex',gap:'0.35rem'}}>
                            <button className="est-quick-btn" onClick={()=>openEdit(v)} style={{fontSize:'0.72rem'}}>Editar</button>
                            <button onClick={()=>handleDelete(v.id)}
                              style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-40)',fontSize:'0.85rem',padding:'0.2rem'}}
                              title="Eliminar">✕</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal para agregar/editar vacuna personalizada */}
      {showForm && (
        <div className="exp-modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="exp-modal" style={{maxWidth:580}} onClick={e=>e.stopPropagation()}>
            <div className="exp-modal__title">{editId?'Editar vacuna':'Registrar vacuna'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'1rem'}}>
              <div className="config-field" style={{gridColumn:'1/-1'}}>
                <label className="config-label">Vacuna *</label>
                <div className="config-select-wrap">
                  <select className="config-select" value={form.vaccine_name}
                    onChange={e=>setForm(p=>({...p,vaccine_name:e.target.value}))}>
                    <option value="">Selecciona...</option>
                    {COMMON_VACCINES.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                {form.vaccine_name==='Otra'&&(
                  <input className="config-input" style={{marginTop:'0.4rem'}}
                    placeholder="Nombre de la vacuna" value={form._custom_name||''}
                    onChange={e=>setForm(p=>({...p,_custom_name:e.target.value,vaccine_name:e.target.value}))} />
                )}
              </div>
              <VacField label="Dosis / Refuerzo">
                <input className="config-input" value={form.dose||''} placeholder="Ej. 1ra dosis, Refuerzo"
                  onChange={e=>setForm(p=>({...p,dose:e.target.value}))} />
              </VacField>
              <VacField label="Fecha de aplicacion">
                <input type="date" className="config-input" value={form.applied_date||''}
                  onChange={e=>setForm(p=>({...p,applied_date:e.target.value}))} />
              </VacField>
              <VacField label="Folio">
                <input className="config-input" value={form.folio||''} placeholder="Folio de la cartilla"
                  onChange={e=>setForm(p=>({...p,folio:e.target.value}))} />
              </VacField>
              <VacField label="Numero de lote">
                <input className="config-input" value={form.lot_number||''} placeholder="Ej. AB12345"
                  onChange={e=>setForm(p=>({...p,lot_number:e.target.value}))} />
              </VacField>
              <VacField label="Fecha de caducidad">
                <input type="date" className="config-input" value={form.expiry_date||''}
                  onChange={e=>setForm(p=>({...p,expiry_date:e.target.value}))} />
              </VacField>
              <VacField label="Laboratorio / Marca">
                <input className="config-input" value={form.brand||''} placeholder="Ej. Pfizer, Sanofi"
                  onChange={e=>setForm(p=>({...p,brand:e.target.value}))} />
              </VacField>
              <VacField label="Aplico (nombre del personal)">
                <input className="config-input" value={form.applied_by||''} placeholder="Nombre del medico o enfermero"
                  onChange={e=>setForm(p=>({...p,applied_by:e.target.value}))} />
              </VacField>
              <VacField label="Notas" full>
                <textarea className="config-textarea" rows={2} value={form.notes||''} placeholder="Observaciones o reacciones..."
                  onChange={e=>setForm(p=>({...p,notes:e.target.value}))} />
              </VacField>
            </div>
            <div className="exp-modal__actions">
              <Button variant="ghost" onClick={()=>setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving||!form.vaccine_name}>
                {saving?'Guardando...':editId?'Actualizar':'Registrar vacuna'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente de cuadricula ──────────────────────────────────
function VaccineGrid({ gridData, canEdit, updateCell, saveCell }) {
  return (
    <div className="vacc-grid-wrap">
      {VACCINE_GROUPS.map(group => (
        <div key={group.id} className="vacc-group">
          <div className="vacc-group-hdr" style={{background:group.color}}>
            {group.label}
          </div>
          <div className="vacc-table-scroll">
            <table className="vacc-table">
              <thead>
                <tr>
                  <th className="vacc-th-vaccine">Vacuna</th>
                  {AGE_COLS.map(col => (
                    <th key={col.id} className="vacc-th-age">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.vaccines.map(vaccine => (
                  <tr key={vaccine.name}>
                    <td className="vacc-td-vaccine">{vaccine.name}</td>
                    {AGE_COLS.map(col => {
                      const dosesAtCol = vaccine.cells.filter(c => c.col === col.id);
                      if (dosesAtCol.length === 0) {
                        return <td key={col.id} className="vacc-td-na" />;
                      }
                      return (
                        <td key={col.id} className="vacc-td-applicable">
                          {dosesAtCol.map(dose => {
                            const key  = gridCellKey(vaccine.name, col.id, dose.dose);
                            const data = gridData[key] || {};
                            const filled = !!(data.applied_date || data.lot_number);
                            return (
                              <div key={dose.dose} className={`vacc-cell${filled?' vacc-cell--filled':''}`}>
                                <div className="vacc-cell-dose">{dose.dose}</div>
                                {canEdit ? (
                                  <>
                                    <div className="vacc-cell-row">
                                      <span className="vacc-cell-lbl">Fecha</span>
                                      <input type="date" className="vacc-cell-inp"
                                        value={data.applied_date||''}
                                        onChange={e=>updateCell(key,'applied_date',e.target.value)}
                                        onBlur={()=>saveCell(key,vaccine.name,dose.dose)} />
                                    </div>
                                    <div className="vacc-cell-row">
                                      <span className="vacc-cell-lbl">Lote</span>
                                      <input type="text" className="vacc-cell-inp"
                                        value={data.lot_number||''}
                                        placeholder="—"
                                        onChange={e=>updateCell(key,'lot_number',e.target.value)}
                                        onBlur={()=>saveCell(key,vaccine.name,dose.dose)} />
                                    </div>
                                    <div className="vacc-cell-row">
                                      <span className="vacc-cell-lbl">Cad.</span>
                                      <input type="date" className="vacc-cell-inp"
                                        value={data.expiry_date||''}
                                        onChange={e=>updateCell(key,'expiry_date',e.target.value)}
                                        onBlur={()=>saveCell(key,vaccine.name,dose.dose)} />
                                    </div>
                                  </>
                                ) : (
                                  <div className="vacc-cell-readonly">
                                    {data.applied_date
                                      ? <><span className="vacc-ro-date">{data.applied_date}</span>{data.lot_number&&<span className="vacc-ro-lot">L:{data.lot_number}</span>}</>
                                      : <span className="vacc-ro-empty">—</span>
                                    }
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// INFORMES MÉDICOS
// ══════════════════════════════════════════════════════════════
function buildTemplate(type, patient, doctor) {
  const name    = patient.full_name || `${patient.first_name} ${patient.last_name || ''}`.trim();
  const age     = calcAge(patient.birth_date || patient.date_of_birth);
  const today   = new Date().toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
  const docName = doctor ? `${doctor.first_name} ${doctor.last_name}` : '[Médico]';
  const cedula  = doctor?.license_number || '[Cédula]';
  const spec    = doctor?.specialty || '[Especialidad]';

  const header = `Dr(a). ${docName}\n${spec}\nCédula Profesional: ${cedula}\n\n`;
  const patientLine = `Paciente: ${name}${age !== null ? `, ${age} años` : ''}`;

  const templates = {
    health_certificate: `CERTIFICADO MÉDICO\n\n${header}Quien suscribe CERTIFICA que el (la) paciente:\n\n${patientLine}\n\nFue valorado(a) en esta fecha encontrándose en BUEN ESTADO DE SALUD, sin contraindicaciones para realizar sus actividades cotidianas.\n\nLo anterior para los fines que al interesado(a) convengan.\n\n${today}\n\n\n_________________________\n${docName}\nCédula Profesional: ${cedula}`,
    passport_letter:    `CARTA MÉDICA PARA PASAPORTE / VIAJE\n\n${header}Por medio de la presente me permito comunicar que el (la) paciente:\n\n${patientLine}\n\nSe encuentra en condiciones óptimas de salud para realizar viaje internacional, no presentando enfermedades infecto-contagiosas activas ni contraindicaciones para el traslado.\n\nSe expide la presente a petición del interesado(a) para los fines que convengan.\n\n${today}\n\n\n_________________________\n${docName}\nCédula Profesional: ${cedula}`,
    sick_leave:         `CONSTANCIA DE INCAPACIDAD\n\n${header}Por medio de la presente se hace constar que el (la) paciente:\n\n${patientLine}\n\nRequiere reposo y se encuentra bajo tratamiento médico, por lo que se le otorga INCAPACIDAD del ______ al ______ (______ días naturales).\n\nDiagnóstico: ________________________________\n\nSe expide la presente para los fines que convengan.\n\n${today}\n\n\n_________________________\n${docName}\nCédula Profesional: ${cedula}`,
    insurance_report:   `DICTAMEN MÉDICO PARA ASEGURADORA\n\n${header}DATOS DEL PACIENTE\n${patientLine}\nFecha de nacimiento: ${fmtDate(patient.birth_date || patient.date_of_birth)}\n\nMOTIVO DEL INFORME\n[Describir el motivo del informe solicitado por la aseguradora]\n\nANTECEDENTES\n[Antecedentes relevantes del paciente]\n\nEXPLORACIÓN FÍSICA\n[Hallazgos relevantes]\n\nDIAGNÓSTICO(S)\n[Diagnósticos con clave CIE-10]\n\nCONCLUSIÓN\n[Conclusión y recomendaciones]\n\n${today}\n\n\n_________________________\n${docName}\nCédula Profesional: ${cedula}`,
    specialist_referral:`REFERENCIA A ESPECIALISTA\n\n${header}Estimado(a) colega:\n\nPor medio de la presente le refiero al (a la) paciente:\n\n${patientLine}\n\nPara valoración por parte de: [Especialidad]\n\nMOTIVO DE REFERENCIA:\n[Describir motivo y hallazgos relevantes]\n\nTRATAMIENTO ACTUAL:\n[Medicamentos y dosis actuales]\n\nAgradezco su valiosa atención.\n\n${today}\n\n\n_________________________\n${docName}\nCédula Profesional: ${cedula}`,
    general:            `INFORME MÉDICO\n\n${header}${patientLine}\n\n[Desarrollar informe médico según requerimiento]\n\n${today}\n\n\n_________________________\n${docName}\nCédula Profesional: ${cedula}`,
  };

  return templates[type] || templates.general;
}

function InformesTab({ patientId, patient, canEdit }) {
  const { user } = useAuth();
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [current, setCurrent]   = useState(null); // null = new
  const [doctor, setDoctor]     = useState(null);
  const [form, setForm]         = useState({ report_type: 'health_certificate', title: '', content: '' });
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get(`/api/patients/${patientId}/reports`)
      .then(r => setReports(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Fetch doctor info for templates
    api.get('/api/doctors').then(r => {
      const docs = r.data?.doctors || r.data || [];
      if (docs.length > 0) setDoctor(docs[0]);
    }).catch(() => {});
  }, [patientId]);

  function openNew() {
    const type = 'health_certificate';
    setForm({ report_type: type, title: 'Certificado de salud', content: buildTemplate(type, patient, doctor) });
    setCurrent(null); setShowEditor(true);
  }

  function openEdit(r) {
    setForm({ report_type: r.report_type, title: r.title, content: r.content || '' });
    setCurrent(r); setShowEditor(true);
  }

  function handleTypeChange(type) {
    const label = REPORT_TYPES.find(t => t.value === type)?.label || '';
    setForm(p => ({ ...p, report_type: type, title: label, content: buildTemplate(type, patient, doctor) }));
  }

  async function handleSave(status = 'draft') {
    if (!form.title) return;
    setSaving(true);
    try {
      const payload = { ...form, status };
      if (current) {
        const res = await api.put(`/api/patients/${patientId}/reports/${current.id}`, payload);
        setReports(prev => prev.map(r => r.id === current.id ? res.data.data : r));
        setCurrent(res.data.data);
      } else {
        const res = await api.post(`/api/patients/${patientId}/reports`, payload);
        setReports(prev => [res.data.data, ...prev]);
        setCurrent(res.data.data);
      }
    } catch { /* */ }
    finally { setSaving(false); }
  }

  async function handleUploadToReport(e) {
    const file = e.target.files?.[0];
    if (!file || !current) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post(`/api/patients/${patientId}/reports/${current.id}/upload`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      setReports(prev => prev.map(r => r.id === current.id ? res.data.data : r));
      setCurrent(res.data.data);
    } catch { /* */ }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function handleUploadNew(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Create report record first
      const rRes = await api.post(`/api/patients/${patientId}/reports`,
        { report_type: 'general', title: file.name, status: 'final' });
      const rid = rRes.data.data.id;
      const fd = new FormData(); fd.append('file', file);
      const upRes = await api.post(`/api/patients/${patientId}/reports/${rid}/upload`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      setReports(prev => [upRes.data.data, ...prev]);
    } catch { /* */ }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este informe?')) return;
    await api.delete(`/api/patients/${patientId}/reports/${id}`);
    setReports(prev => prev.filter(r => r.id !== id));
  }

  function handlePrint() {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${form.title}</title>
      <style>body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.7;max-width:700px;margin:40px auto;white-space:pre-wrap;}
      @media print{body{margin:20px;}}</style></head>
      <body>${form.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  if (loading) return <p className="pp-loading">Cargando informes...</p>;

  if (showEditor) return (
    <div className="pp-report-editor">
      <div className="pp-report-editor__toolbar">
        <div className="config-select-wrap" style={{flex:'0 0 240px'}}>
          <select className="config-select" value={form.report_type} onChange={e => handleTypeChange(e.target.value)}>
            {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <input className="exp-text-input" style={{flex:1}} value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder="Título del informe" />
        <div style={{display:'flex',gap:'0.5rem',flexShrink:0}}>
          <button className="est-quick-btn" onClick={handlePrint}>🖨 Imprimir</button>
          {current && (
            <>
              <button className="doc-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? '...' : '📎 Adjuntar PDF'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{display:'none'}} onChange={handleUploadToReport} />
            </>
          )}
          <Button variant="ghost" onClick={() => handleSave('draft')} disabled={saving}>Borrador</Button>
          <Button onClick={() => handleSave('final')} disabled={saving}>{saving ? 'Guardando...' : 'Guardar informe'}</Button>
          <button className="est-quick-btn" onClick={() => setShowEditor(false)}>← Volver</button>
        </div>
      </div>
      <textarea
        className="pp-report-textarea"
        value={form.content}
        onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
        placeholder="Contenido del informe..."
        spellCheck
      />
      {current?.file_url && (
        <div className="pp-report-attachment">
          📎 <a href={current.file_url} target="_blank" rel="noreferrer">{current.file_name || 'Archivo adjunto'}</a>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {canEdit && (
        <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.25rem'}}>
          <Button onClick={openNew}>+ Generar informe</Button>
          <button className="doc-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : '↑ Cargar informe externo'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,image/*,.doc,.docx"
            style={{display:'none'}} onChange={handleUploadNew} />
        </div>
      )}

      {reports.length === 0 ? (
        <div className="pp-empty"><div className="pp-empty__icon">📝</div><p>Sin informes registrados.</p></div>
      ) : (
        <div className="pp-files-list">
          {reports.map(r => (
            <div key={r.id} className="pp-file-card">
              <div className="pp-file-card__icon">
                {r.report_type === 'insurance_report' ? '🏢' : r.file_url && !r.content ? '📎' : '📝'}
              </div>
              <div className="pp-file-card__info">
                <span className="pp-file-card__name">{r.title}</span>
                <div className="pp-file-card__meta">
                  <span>{REPORT_TYPES.find(t=>t.value===r.report_type)?.label || r.report_type}</span>
                  <span>{fmtDate(r.created_at?.split('T')[0])}</span>
                  <span className={r.status === 'final' ? 'doc-badge doc-badge--ok' : 'doc-badge doc-badge--neutral'} style={{fontSize:'0.7rem'}}>
                    {r.status === 'final' ? 'Final' : 'Borrador'}
                  </span>
                </div>
              </div>
              <div className="pp-file-card__actions">
                {r.content && <button className="pp-file-link" onClick={() => openEdit(r)}>Editar</button>}
                {r.file_url && <a href={r.file_url} target="_blank" rel="noreferrer" className="pp-file-link">Ver</a>}
                {canEdit && <button className="pp-file-del" onClick={() => handleDelete(r.id)}>✕</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Micro-helpers de UI ───────────────────────────────────────
function HField({ label, children, full, style }) {
  return (
    <div className={`config-field${full ? ' pp-field--full' : ''}`} style={style}>
      <label className="config-label">{label}</label>
      {children}
    </div>
  );
}
function VacField({ label, children, full }) {
  return (
    <div className="config-field" style={full ? {gridColumn:'1/-1'} : {}}>
      <label className="config-label">{label}</label>
      {children}
    </div>
  );
}
function PPInput({ value, onChange, disabled, ...rest }) {
  return <input className="config-input" value={value} disabled={disabled}
    onChange={e => onChange(e.target.value)} {...rest} />;
}
function PPTextarea({ value, onChange, disabled, rows = 3, placeholder }) {
  return <textarea className="config-textarea" rows={rows} value={value} disabled={disabled}
    placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}
function PPSelect({ value, onChange, disabled, children }) {
  return (
    <div className="config-select-wrap">
      <select className="config-select" value={value} disabled={disabled}
        onChange={e => onChange(e.target.value)}>{children}</select>
    </div>
  );
}

