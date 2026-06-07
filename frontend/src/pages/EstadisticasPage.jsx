import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import api from '../services/api';
import '../styles/ayuda.css';
import '../styles/estadisticas.css';

// ─── ENO para SUIVE (enfermedades de notificación obligatoria) ────
const ENO_LIST = [
  'Influenza','COVID-19','Dengue','Hepatitis A','Hepatitis B','Hepatitis C',
  'Tuberculosis','Sífilis','VIH/SIDA','Gonorrea','Salmonelosis','Brucelosis',
  'Paludismo','Leishmaniasis','Rabia humana','Tosferina','Sarampión','Rubeola',
  'Varicela','Meningitis bacteriana','Neumonía y bronconeumonía','Intoxicación alimentaria',
  'Enfermedad de Chagas','Leptospirosis','Rickettsiosis','Otra ENO',
];

const MOV_CATS_INGRESO = ['Consulta','Procedimiento','Estudio','Cirugía','Asesoría','Otro'];
const MOV_CATS_EGRESO  = ['Renta consultorio','Insumos médicos','Equipo','Personal','Capacitación','Servicios','Otro'];
const METODOS_PAGO     = ['Efectivo','Transferencia','Tarjeta crédito','Tarjeta débito','MercadoPago','PayPal','Cheque'];

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
const fmtK = (n) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${Math.round(n)}`;

// ── Fecha helpers ────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function monthStart() { const d=new Date(); d.setDate(1); return d.toISOString().split('T')[0]; }
function yearStart()  { const d=new Date(); d.setMonth(0,1); return d.toISOString().split('T')[0]; }

// ── Simple bar chart (CSS) ───────────────────────────────────
function BarChart({ data, valueKey, labelKey, colorClass='bar-chart__bar--primary', height=140 }) {
  if (!data || data.length === 0) return <div className="est-empty" style={{padding:'1rem'}}><p>Sin datos</p></div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="bar-chart__bar-wrap">
          <div
            className={`bar-chart__bar ${colorClass}`}
            style={{ height: `${((d[valueKey] || 0) / max) * 100}%` }}
            title={`${d[labelKey]}: ${d[valueKey]}`}
          />
          <span className="bar-chart__label">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut SVG ────────────────────────────────────────────────
const COLORS = ['#2D5A3D','#A8C4B0','#5A7066','#C8DCCB','#EAF0EB','#1B3A2A'];
function Donut({ data, valueKey, labelKey, size=120 }) {
  if (!data || data.length === 0) return <div className="est-empty" style={{padding:'1rem'}}><p>Sin datos</p></div>;
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  const r = 40, cx = size/2, cy = size/2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map((d, i) => {
    const pct = total ? (d[valueKey] || 0) / total : 0;
    const slice = { ...d, pct, dasharray: pct * circumference, dashoffset: -offset * circumference, color: COLORS[i % COLORS.length] };
    offset += pct;
    return slice;
  });
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--cream-mid)" strokeWidth="18" />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth="18"
            strokeDasharray={`${s.dasharray} ${circumference}`}
            strokeDashoffset={s.dashoffset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy+4} textAnchor="middle" fontSize="12" fontFamily="Cormorant Garamond, Georgia, serif" fontWeight="300" fill="var(--ink)">{total}</text>
      </svg>
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div key={i} className="donut-legend-item">
            <div className="donut-legend-item__left">
              <div className="donut-legend-item__dot" style={{background:s.color}} />
              <span>{s[labelKey]}</span>
            </div>
            <span className="donut-legend-item__val">{s[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── H-bars ───────────────────────────────────────────────────
function HBars({ data, valueKey, labelKey, colorClass='', maxOverride }) {
  if (!data || data.length === 0) return <div style={{color:'var(--ink-40)',fontSize:'0.83rem'}}>Sin datos</div>;
  const max = maxOverride || Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="h-bars">
      {data.slice(0,8).map((d, i) => (
        <div key={i} className="h-bar-item">
          <div className="h-bar-item__top">
            <span className="h-bar-item__label">{d[labelKey]}</span>
            <span className="h-bar-item__val">{d[valueKey]}</span>
          </div>
          <div className="h-bar-item__track">
            <div className={`h-bar-item__fill ${colorClass}`} style={{width:`${((d[valueKey]||0)/max)*100}%`}} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function EstadisticasPage() {
  const [tab, setTab] = useState('resumen');
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(todayStr());
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);

  const TABS = [
    { id: 'resumen',   label: '📊 Resumen' },
    { id: 'consultas', label: '🏥 Consultas' },
    { id: 'cobros',    label: '💰 Ingresos y egresos' },
    { id: 'suive',     label: '🦠 SUIVE' },
    { id: 'busqueda',  label: '🔍 Búsqueda' },
  ];

  const loadResumen = useCallback(() => {
    setLoading(true);
    api.get(`/api/estadisticas/resumen?desde=${desde}&hasta=${hasta}`)
      .then(r => setResumen(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  useEffect(() => { loadResumen(); }, [loadResumen]);

  function applyQuick(period) {
    const hoy = todayStr();
    if (period === 'mes')     { setDesde(monthStart()); setHasta(hoy); }
    if (period === 'trimestre') {
      const d = new Date(); d.setMonth(d.getMonth() - 3);
      setDesde(d.toISOString().split('T')[0]); setHasta(hoy);
    }
    if (period === 'año')     { setDesde(yearStart()); setHasta(hoy); }
  }

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Estadísticas" />
        <div className="nota-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Estadísticas</h1>
              <p className="page-subtitle">Consultas, cobros, ingresos, egresos y vigilancia epidemiológica</p>
            </div>
          </div>

          {/* Filtros globales */}
          <div className="est-filters">
            <span className="est-filters__label">Período</span>
            <input type="date" className="est-date-input" value={desde} onChange={e => setDesde(e.target.value)} />
            <span className="est-filter-sep">—</span>
            <input type="date" className="est-date-input" value={hasta} onChange={e => setHasta(e.target.value)} />
            <div className="est-quick-btns">
              <button className="est-quick-btn" onClick={() => applyQuick('mes')}>Este mes</button>
              <button className="est-quick-btn" onClick={() => applyQuick('trimestre')}>Trimestre</button>
              <button className="est-quick-btn" onClick={() => applyQuick('año')}>Este año</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="ayuda-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`ayuda-tab ${tab === t.id ? 'ayuda-tab--active' : ''}`}
                onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === 'resumen'   && <ResumenTab resumen={resumen} loading={loading} />}
          {tab === 'consultas' && <ConsultasTab desde={desde} hasta={hasta} />}
          {tab === 'cobros'    && <CobrosTab desde={desde} hasta={hasta} />}
          {tab === 'suive'     && <SuiveTab desde={desde} hasta={hasta} />}
          {tab === 'busqueda'  && <BusquedaTab desde={desde} hasta={hasta} />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// RESUMEN
// ══════════════════════════════════════════════════════════════
function ResumenTab({ resumen, loading }) {
  if (loading) return <p style={{color:'var(--ink-40)',padding:'2rem 0'}}>Cargando...</p>;
  if (!resumen) return null;
  const { consultas, financiero, suive, pacientes } = resumen;
  return (
    <>
      <div className="est-kpi-grid">
        <div className="est-kpi">
          <span className="est-kpi__icon">📅</span>
          <span className="est-kpi__value">{consultas.total}</span>
          <span className="est-kpi__label">Total consultas</span>
          <span className="est-kpi__delta est-kpi__delta--up">✓ {consultas.completadas} completadas</span>
        </div>
        <div className="est-kpi">
          <span className="est-kpi__icon">👥</span>
          <span className="est-kpi__value">{pacientes.total}</span>
          <span className="est-kpi__label">Pacientes registrados</span>
        </div>
        <div className="est-kpi est-kpi--forest">
          <span className="est-kpi__icon">💰</span>
          <span className="est-kpi__value">{fmtK(financiero.ingresos)}</span>
          <span className="est-kpi__label">Ingresos</span>
          <span style={{fontSize:'0.72rem',color:'var(--accent-teal)'}}>Balance: {fmtK(financiero.balance)}</span>
        </div>
        <div className="est-kpi">
          <span className="est-kpi__icon">🦠</span>
          <span className="est-kpi__value">{suive.total}</span>
          <span className="est-kpi__label">Reportes SUIVE</span>
          {suive.pendientes > 0 && <span className="est-kpi__delta est-kpi__delta--down">⚠ {suive.pendientes} pendientes</span>}
        </div>
      </div>

      <div className="est-charts-grid">
        <div className="est-chart-card">
          <div className="est-chart-card__title">Estado de consultas</div>
          <BarChart
            data={[
              { label: 'Completadas', value: consultas.completadas },
              { label: 'Programadas', value: consultas.programadas },
              { label: 'Canceladas',  value: consultas.canceladas },
            ]}
            valueKey="value" labelKey="label" />
        </div>
        <div className="est-chart-card">
          <div className="est-chart-card__title">Distribución</div>
          <Donut
            data={[
              { label: 'Completadas', value: consultas.completadas },
              { label: 'Programadas', value: consultas.programadas },
              { label: 'Canceladas',  value: consultas.canceladas },
            ]}
            valueKey="value" labelKey="label" />
        </div>
      </div>

      <div className="est-chart-card">
        <div className="est-chart-card__title">Resumen financiero del período</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem',marginTop:'0.25rem'}}>
          <div>
            <div style={{fontSize:'0.72rem',fontWeight:600,textTransform:'uppercase',color:'var(--ink-40)',letterSpacing:'0.06em',marginBottom:'0.35rem'}}>Ingresos</div>
            <div style={{fontFamily:'var(--font-serif)',fontSize:'1.75rem',fontWeight:300,color:'var(--forest-mid)'}}>
              ${fmt(financiero.ingresos)}
            </div>
          </div>
          <div>
            <div style={{fontSize:'0.72rem',fontWeight:600,textTransform:'uppercase',color:'var(--ink-40)',letterSpacing:'0.06em',marginBottom:'0.35rem'}}>Egresos</div>
            <div style={{fontFamily:'var(--font-serif)',fontSize:'1.75rem',fontWeight:300,color:'var(--error)'}}>
              ${fmt(financiero.egresos)}
            </div>
          </div>
          <div>
            <div style={{fontSize:'0.72rem',fontWeight:600,textTransform:'uppercase',color:'var(--ink-40)',letterSpacing:'0.06em',marginBottom:'0.35rem'}}>Balance</div>
            <div style={{fontFamily:'var(--font-serif)',fontSize:'1.75rem',fontWeight:300,color: financiero.balance >= 0 ? 'var(--forest-mid)' : 'var(--error)'}}>
              ${fmt(financiero.balance)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// CONSULTAS
// ══════════════════════════════════════════════════════════════
function ConsultasTab({ desde, hasta }) {
  const [data, setData] = useState(null);
  const [agr, setAgr] = useState('mes');

  useEffect(() => {
    api.get(`/api/estadisticas/consultas?desde=${desde}&hasta=${hasta}&agrupacion=${agr}`)
      .then(r => setData(r.data)).catch(() => {});
  }, [desde, hasta, agr]);

  if (!data) return <p style={{color:'var(--ink-40)'}}>Cargando...</p>;

  const serieFmt = data.serie.map(s => ({
    ...s,
    label: s.periodo.length === 7
      ? new Date(s.periodo + '-01').toLocaleDateString('es-MX', {month:'short',year:'2-digit'})
      : s.periodo,
  }));

  return (
    <>
      <div className="est-kpi-grid">
        <div className="est-kpi"><span className="est-kpi__icon">📅</span><span className="est-kpi__value">{data.total}</span><span className="est-kpi__label">Total</span></div>
        <div className="est-kpi"><span className="est-kpi__icon">✅</span><span className="est-kpi__value">{data.serie.reduce((s,d)=>s+d.completadas,0)}</span><span className="est-kpi__label">Completadas</span></div>
        <div className="est-kpi"><span className="est-kpi__icon">❌</span><span className="est-kpi__value">{data.serie.reduce((s,d)=>s+d.canceladas,0)}</span><span className="est-kpi__label">Canceladas</span></div>
        <div className="est-kpi"><span className="est-kpi__icon">👻</span><span className="est-kpi__value">{data.serie.reduce((s,d)=>s+d.no_show,0)}</span><span className="est-kpi__label">No se presentó</span></div>
      </div>

      <div className="est-charts-grid">
        <div className="est-chart-card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
            <div className="est-chart-card__title" style={{margin:0}}>Consultas por período</div>
            <div style={{display:'flex',gap:'0.4rem'}}>
              {['mes','semana'].map(a => (
                <button key={a} className={`est-quick-btn ${agr===a?'est-quick-btn--active':''}`} onClick={()=>setAgr(a)}>
                  {a==='mes'?'Mensual':'Semanal'}
                </button>
              ))}
            </div>
          </div>
          <BarChart data={serieFmt} valueKey="completadas" labelKey="label" />
        </div>
        <div className="est-chart-card">
          <div className="est-chart-card__title">Por especialidad</div>
          <HBars data={data.por_especialidad} valueKey="total" labelKey="especialidad" />
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// INGRESOS Y EGRESOS
// ══════════════════════════════════════════════════════════════
function CobrosTab({ desde, hasta }) {
  const [data, setData]       = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [movForm, setMovForm] = useState({ tipo:'ingreso', categoria:'Consulta', concepto:'', monto:'', fecha:todayStr(), metodo_pago:'Efectivo', notas:'' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    api.get(`/api/estadisticas/financiero?desde=${desde}&hasta=${hasta}`)
      .then(r => setData(r.data)).catch(() => {});
  }, [desde, hasta]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveMov() {
    setSaving(true);
    try {
      await api.post('/api/estadisticas/movimiento', { ...movForm, monto: parseFloat(movForm.monto) });
      setShowModal(false);
      setMovForm({ tipo:'ingreso', categoria:'Consulta', concepto:'', monto:'', fecha:todayStr(), metodo_pago:'Efectivo', notas:'' });
      load();
    } catch(e) {} finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await api.delete(`/api/estadisticas/movimiento/${id}`);
    load();
  }

  function exportCSV() {
    if (!data?.movimientos?.length) return;
    const rows = [['Fecha','Tipo','Categoría','Concepto','Monto','Método']];
    data.movimientos.forEach(m => rows.push([m.fecha, m.tipo, m.categoria||'', m.concepto, m.monto, m.metodo_pago||'']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `movimientos_${desde}_${hasta}.csv`; a.click();
  }

  if (!data) return <p style={{color:'var(--ink-40)'}}>Cargando...</p>;
  const { resumen, serie, por_categoria, movimientos } = data;
  const cats = (por_categoria || []).sort((a,b) => (b.ingresos+b.egresos)-(a.ingresos+a.egresos));

  return (
    <>
      <div className="est-kpi-grid">
        <div className="est-kpi est-kpi--forest"><span className="est-kpi__icon">💰</span><span className="est-kpi__value">{fmtK(resumen.total_ingresos)}</span><span className="est-kpi__label">Ingresos</span></div>
        <div className="est-kpi"><span className="est-kpi__icon">💸</span><span className="est-kpi__value">{fmtK(resumen.total_egresos)}</span><span className="est-kpi__label">Egresos</span></div>
        <div className="est-kpi"><span className="est-kpi__icon">⚖️</span>
          <span className="est-kpi__value" style={{color: resumen.total_ingresos-resumen.total_egresos >= 0 ? 'var(--forest-mid)' : 'var(--error)'}}>
            {fmtK(resumen.total_ingresos - resumen.total_egresos)}
          </span>
          <span className="est-kpi__label">Balance</span>
        </div>
        <div className="est-kpi"><span className="est-kpi__icon">📋</span><span className="est-kpi__value">{movimientos.length}</span><span className="est-kpi__label">Movimientos</span></div>
      </div>

      <div className="est-charts-grid" style={{marginBottom:'1.5rem'}}>
        <div className="est-chart-card">
          <div className="est-chart-card__title">Ingresos vs Egresos por mes</div>
          {serie.length === 0
            ? <div className="est-empty"><p>Sin datos en el período</p></div>
            : <BarChart
                data={serie.map(s => ({
                  label: new Date(s.periodo+'-01').toLocaleDateString('es-MX',{month:'short'}),
                  value: s.ingresos,
                }))}
                valueKey="value" labelKey="label" />
          }
        </div>
        <div className="est-chart-card">
          <div className="est-chart-card__title">Por categoría</div>
          <HBars
            data={cats.map(c => ({ label: c.categoria, value: c.ingresos + c.egresos }))}
            valueKey="value" labelKey="label"
            maxOverride={Math.max(...cats.map(c=>c.ingresos+c.egresos),1)} />
        </div>
      </div>

      {/* Tabla movimientos */}
      <div className="est-table-wrap">
        <div className="est-table-header">
          <span className="est-table-header__title">Movimientos ({movimientos.length})</span>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="est-quick-btn" onClick={exportCSV}>↓ Exportar CSV</button>
            <Button onClick={() => setShowModal(true)}>+ Registrar</Button>
          </div>
        </div>
        {movimientos.length === 0
          ? <div className="est-empty"><div className="est-empty__icon">💳</div><p>Sin movimientos registrados</p></div>
          : <table className="est-table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Concepto</th><th>Método</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.8rem',color:'var(--ink-40)'}}>{m.fecha}</td>
                    <td><span className={`tipo-badge tipo-badge--${m.tipo}`}>{m.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}</span></td>
                    <td style={{color:'var(--ink-40)',fontSize:'0.82rem'}}>{m.categoria || '—'}</td>
                    <td>{m.concepto}</td>
                    <td style={{color:'var(--ink-40)',fontSize:'0.82rem'}}>{m.metodo_pago || '—'}</td>
                    <td><span className={m.tipo==='ingreso'?'monto-ingreso':'monto-egreso'}>
                      {m.tipo==='ingreso'?'+':'-'}${fmt(m.monto)}
                    </span></td>
                    <td><button onClick={() => handleDelete(m.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-40)',fontSize:'0.85rem',padding:'0.2rem'}} title="Eliminar">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {/* Modal nuevo movimiento */}
      {showModal && (
        <div className="mov-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="mov-modal" onClick={e => e.stopPropagation()}>
            <div className="mov-modal__header">
              <span className="mov-modal__title">Registrar movimiento</span>
              <button className="mov-modal__close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="mov-modal__body">
              <MovField label="Tipo">
                <div style={{display:'flex',gap:'0.5rem'}}>
                  {['ingreso','egreso'].map(t => (
                    <button key={t} onClick={()=>setMovForm(p=>({...p,tipo:t,categoria:t==='ingreso'?'Consulta':'Renta consultorio'}))}
                      className={`est-quick-btn ${movForm.tipo===t?'est-quick-btn--active':''}`} style={{flex:1}}>
                      {t==='ingreso'?'↑ Ingreso':'↓ Egreso'}
                    </button>
                  ))}
                </div>
              </MovField>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <MovField label="Fecha">
                  <input type="date" className="est-date-input" style={{width:'100%'}} value={movForm.fecha}
                    onChange={e=>setMovForm(p=>({...p,fecha:e.target.value}))} />
                </MovField>
                <MovField label="Categoría">
                  <SelectWrap value={movForm.categoria} onChange={v=>setMovForm(p=>({...p,categoria:v}))}>
                    {(movForm.tipo==='ingreso'?MOV_CATS_INGRESO:MOV_CATS_EGRESO).map(c=><option key={c} value={c}>{c}</option>)}
                  </SelectWrap>
                </MovField>
              </div>
              <MovField label="Concepto">
                <input className="config-input" value={movForm.concepto}
                  onChange={e=>setMovForm(p=>({...p,concepto:e.target.value}))}
                  placeholder="Describe el movimiento..." />
              </MovField>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <MovField label="Monto (MXN)">
                  <input type="number" className="config-input" value={movForm.monto}
                    onChange={e=>setMovForm(p=>({...p,monto:e.target.value}))} placeholder="0.00" min="0" step="0.01" />
                </MovField>
                <MovField label="Método de pago">
                  <SelectWrap value={movForm.metodo_pago} onChange={v=>setMovForm(p=>({...p,metodo_pago:v}))}>
                    {METODOS_PAGO.map(m=><option key={m} value={m}>{m}</option>)}
                  </SelectWrap>
                </MovField>
              </div>
              <MovField label="Notas (opcional)">
                <textarea className="config-textarea" rows={2} value={movForm.notas}
                  onChange={e=>setMovForm(p=>({...p,notas:e.target.value}))} placeholder="Notas adicionales..." />
              </MovField>
            </div>
            <div className="mov-modal__footer">
              <Button variant="ghost" onClick={()=>setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSaveMov} disabled={saving||!movForm.concepto||!movForm.monto}>
                {saving?'Guardando...':'Registrar movimiento'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// SUIVE
// ══════════════════════════════════════════════════════════════
function SuiveTab({ desde, hasta }) {
  const [data, setData]     = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]     = useState({ enfermedad:'', clave_cie10:'', fecha_inicio_sintomas:'', fecha_diagnostico:todayStr(), edad_paciente:'', sexo:'', municipio:'', estado:'', notas:'' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get(`/api/estadisticas/suive?desde=${desde}&hasta=${hasta}`)
      .then(r => setData(r.data)).catch(() => {});
  }, [desde, hasta]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/api/estadisticas/suive', { ...form, edad_paciente: form.edad_paciente ? parseInt(form.edad_paciente) : null });
      setShowForm(false);
      setForm({ enfermedad:'', clave_cie10:'', fecha_inicio_sintomas:'', fecha_diagnostico:todayStr(), edad_paciente:'', sexo:'', municipio:'', estado:'', notas:'' });
      load();
    } catch(e) {} finally { setSaving(false); }
  }

  async function handleReportar(id) {
    await api.put(`/api/estadisticas/suive/${id}/reportar`);
    load();
  }

  function exportSUIVE() {
    if (!data?.reportes?.length) return;
    const rows = [['Folio','Enfermedad','CIE-10','Fecha Dx','Edad','Sexo','Municipio','Estado','Semana Epi','Status']];
    data.reportes.forEach((r,i) => rows.push([
      `SUIVE-${String(i+1).padStart(4,'0')}`, r.enfermedad, r.clave_cie10||'', r.fecha_diagnostico,
      r.edad_paciente||'', r.sexo||'', r.municipio||'', r.estado||'', r.semana_epidemiologica||'', r.status
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `SUIVE_${desde}_${hasta}.csv`; a.click();
  }

  if (!data) return <p style={{color:'var(--ink-40)'}}>Cargando...</p>;
  const { reportes, por_enfermedad } = data;

  return (
    <>
      <div className="suive-kpi-row">
        <div className="est-kpi"><span className="est-kpi__icon">🦠</span><span className="est-kpi__value">{reportes.length}</span><span className="est-kpi__label">Total reportes</span></div>
        <div className="est-kpi"><span className="est-kpi__icon">⏳</span><span className="est-kpi__value">{reportes.filter(r=>r.status==='pendiente').length}</span><span className="est-kpi__label">Pendientes</span></div>
        <div className="est-kpi"><span className="est-kpi__icon">✅</span><span className="est-kpi__value">{reportes.filter(r=>r.status==='reportado').length}</span><span className="est-kpi__label">Reportados</span></div>
      </div>

      {por_enfermedad.length > 0 && (
        <div className="est-chart-card" style={{marginBottom:'1.5rem'}}>
          <div className="est-chart-card__title">Casos por enfermedad</div>
          <HBars data={por_enfermedad} valueKey="total" labelKey="enfermedad" />
        </div>
      )}

      <div className="est-table-wrap">
        <div className="est-table-header">
          <span className="est-table-header__title">Registros ({reportes.length})</span>
          <div style={{display:'flex',gap:'0.5rem'}}>
            <button className="est-quick-btn" onClick={exportSUIVE}>↓ Exportar SUIVE</button>
            <Button onClick={() => setShowForm(true)}>+ Nuevo reporte</Button>
          </div>
        </div>
        {reportes.length === 0
          ? <div className="est-empty"><div className="est-empty__icon">🦠</div><p>Sin reportes en el período</p></div>
          : <table className="est-table">
              <thead><tr><th>Fecha Dx</th><th>Enfermedad</th><th>CIE-10</th><th>Edad</th><th>Sem. Epi</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>
                {reportes.map(r => (
                  <tr key={r.id}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.8rem',color:'var(--ink-40)'}}>{r.fecha_diagnostico}</td>
                    <td style={{fontWeight:500}}>{r.enfermedad}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.78rem',color:'var(--ink-40)'}}>{r.clave_cie10||'—'}</td>
                    <td>{r.edad_paciente ? `${r.edad_paciente} años` : '—'}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.8rem'}}>S{r.semana_epidemiologica}</td>
                    <td><span className={`suive-table-status suive-status--${r.status}`}>{r.status==='reportado'?'✓ Reportado':'⏳ Pendiente'}</span></td>
                    <td>
                      {r.status === 'pendiente' && (
                        <button className="est-quick-btn" style={{fontSize:'0.72rem'}} onClick={() => handleReportar(r.id)}>
                          Marcar reportado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      {/* Formulario nuevo reporte */}
      {showForm && (
        <div className="mov-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="mov-modal" style={{maxWidth:620}} onClick={e => e.stopPropagation()}>
            <div className="mov-modal__header">
              <span className="mov-modal__title">Nuevo reporte SUIVE</span>
              <button className="mov-modal__close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="mov-modal__body" style={{maxHeight:'70vh',overflowY:'auto'}}>
              <MovField label="Enfermedad de notificación obligatoria *">
                <SelectWrap value={form.enfermedad} onChange={v => setForm(p=>({...p,enfermedad:v}))}>
                  <option value="">Selecciona...</option>
                  {ENO_LIST.map(e => <option key={e} value={e}>{e}</option>)}
                </SelectWrap>
              </MovField>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                <MovField label="Clave CIE-10">
                  <input className="config-input" value={form.clave_cie10}
                    onChange={e=>setForm(p=>({...p,clave_cie10:e.target.value}))} placeholder="Ej. J11" />
                </MovField>
                <MovField label="Fecha diagnóstico">
                  <input type="date" className="est-date-input" style={{width:'100%'}} value={form.fecha_diagnostico}
                    onChange={e=>setForm(p=>({...p,fecha_diagnostico:e.target.value}))} />
                </MovField>
                <MovField label="Inicio de síntomas">
                  <input type="date" className="est-date-input" style={{width:'100%'}} value={form.fecha_inicio_sintomas}
                    onChange={e=>setForm(p=>({...p,fecha_inicio_sintomas:e.target.value}))} />
                </MovField>
                <MovField label="Edad del paciente">
                  <input type="number" className="config-input" value={form.edad_paciente}
                    onChange={e=>setForm(p=>({...p,edad_paciente:e.target.value}))} placeholder="Años" min="0" max="120" />
                </MovField>
                <MovField label="Sexo">
                  <SelectWrap value={form.sexo} onChange={v=>setForm(p=>({...p,sexo:v}))}>
                    <option value="">—</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </SelectWrap>
                </MovField>
                <MovField label="Municipio">
                  <input className="config-input" value={form.municipio}
                    onChange={e=>setForm(p=>({...p,municipio:e.target.value}))} placeholder="Ej. Monterrey" />
                </MovField>
                <MovField label="Estado">
                  <input className="config-input" value={form.estado}
                    onChange={e=>setForm(p=>({...p,estado:e.target.value}))} placeholder="Ej. Nuevo León" />
                </MovField>
              </div>
              <MovField label="Notas">
                <textarea className="config-textarea" rows={2} value={form.notas}
                  onChange={e=>setForm(p=>({...p,notas:e.target.value}))} />
              </MovField>
            </div>
            <div className="mov-modal__footer">
              <Button variant="ghost" onClick={()=>setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving||!form.enfermedad}>{saving?'Guardando...':'Guardar reporte'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// BÚSQUEDA DE ESTADÍSTICAS
// ══════════════════════════════════════════════════════════════
const BUSQUEDA_CATS = [
  { id: 'all',       label: 'Todo' },
  { id: 'consultas', label: '🏥 Consultas' },
  { id: 'pacientes', label: '👥 Pacientes' },
  { id: 'financiero',label: '💰 Financiero' },
  { id: 'suive',     label: '🦠 SUIVE' },
];

function BusquedaTab({ desde, hasta }) {
  const [q, setQ]           = useState('');
  const [cat, setCat]       = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setSearched(true);

    try {
      const [apptRes, movRes, suiveRes] = await Promise.all([
        api.get(`/api/estadisticas/consultas?desde=${desde}&hasta=${hasta}`),
        api.get(`/api/estadisticas/financiero?desde=${desde}&hasta=${hasta}`),
        api.get(`/api/estadisticas/suive?desde=${desde}&hasta=${hasta}`),
      ]);

      const all = [];
      const term = q.toLowerCase();

      // Consultas
      if (cat === 'all' || cat === 'consultas') {
        apptRes.data.por_especialidad
          .filter(e => e.especialidad.toLowerCase().includes(term))
          .forEach(e => all.push({ type: 'consulta', icon: '🏥', title: e.especialidad, sub: 'Especialidad', value: `${e.total} consultas` }));
      }

      // Financiero
      if (cat === 'all' || cat === 'financiero') {
        (movRes.data.movimientos || [])
          .filter(m => m.concepto.toLowerCase().includes(term) || (m.categoria||'').toLowerCase().includes(term))
          .slice(0, 10)
          .forEach(m => all.push({ type: 'financiero', icon: m.tipo==='ingreso'?'💰':'💸', title: m.concepto, sub: `${m.fecha} · ${m.categoria||''}`, value: `${m.tipo==='ingreso'?'+':'-'}$${fmt(m.monto)}` }));
      }

      // SUIVE
      if (cat === 'all' || cat === 'suive') {
        (suiveRes.data.reportes || [])
          .filter(r => r.enfermedad.toLowerCase().includes(term))
          .forEach(r => all.push({ type: 'suive', icon: '🦠', title: r.enfermedad, sub: `Dx: ${r.fecha_diagnostico} · ${r.status}`, value: r.clave_cie10||'Sin CIE-10' }));
      }

      setResults(all);
    } catch(e) { setResults([]); }
    finally { setLoading(false); }
  }

  return (
    <div className="busqueda-wrap">
      <form onSubmit={handleSearch}>
        <div className="busqueda-input-wrap">
          <span className="busqueda-input__icon">🔍</span>
          <input className="busqueda-input" value={q}
            onChange={e => { setQ(e.target.value); setSearched(false); }}
            placeholder="Busca consultas, movimientos, diagnósticos..." />
        </div>
      </form>

      <div className="busqueda-cats">
        {BUSQUEDA_CATS.map(c => (
          <button key={c.id} className={`faq-cat ${cat===c.id?'faq-cat--active':''}`}
            onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>

      {loading && <p style={{color:'var(--ink-40)'}}>Buscando...</p>}

      {!loading && searched && results.length === 0 && (
        <div className="est-empty">
          <div className="est-empty__icon">🔍</div>
          <p style={{fontWeight:500,color:'var(--ink)'}}>Sin resultados para "{q}"</p>
          <p style={{fontSize:'0.83rem',marginTop:'0.3rem'}}>Prueba con otros términos o cambia el período de búsqueda.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="busqueda-results">
          {results.map((r, i) => (
            <div key={i} className="busqueda-result-card">
              <div className="busqueda-result-card__icon">{r.icon}</div>
              <div className="busqueda-result-card__info">
                <div className="busqueda-result-card__title">{r.title}</div>
                <div className="busqueda-result-card__sub">{r.sub}</div>
              </div>
              <span className="busqueda-result-card__value">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div style={{color:'var(--ink-40)',fontSize:'0.85rem',lineHeight:1.7}}>
          <p>Busca a través de todos los datos del período seleccionado:</p>
          <ul style={{marginTop:'0.5rem',paddingLeft:'1.25rem',display:'flex',flexDirection:'column',gap:'0.25rem'}}>
            <li>Consultas por especialidad o médico</li>
            <li>Movimientos financieros por concepto o categoría</li>
            <li>Reportes SUIVE por enfermedad o diagnóstico</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────
function MovField({ label, children }) {
  return (
    <div className="config-field">
      <label className="config-label">{label}</label>
      {children}
    </div>
  );
}

function SelectWrap({ value, onChange, children }) {
  return (
    <div className="config-select-wrap">
      <select className="config-select" value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}
