import { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import api from '../services/api';
import '../styles/ayuda.css';
import '../styles/planes.css';

// ─── Datos de planes ─────────────────────────────────────────
const PLANES = [
  {
    id: 'basico',
    nombre: 'Básico',
    desc: 'Para médicos que inician su práctica digital.',
    precios: { monthly: 0, annual: 0 },
    features: [
      { label: 'Hasta 50 pacientes', ok: true },
      { label: '1 médico', ok: true },
      { label: 'Citas y expediente básico', ok: true },
      { label: 'Nota SOAP', ok: true },
      { label: 'Valeria (recepcionista IA)', ok: false },
      { label: 'AI Scribe (dictado)', ok: false },
      { label: 'Papelería personalizada', ok: false },
      { label: 'Cobros online', ok: false },
      { label: 'Soporte prioritario', ok: false },
    ],
  },
  {
    id: 'pro',
    nombre: 'Pro',
    popular: true,
    desc: 'Todo lo que necesita un consultorio médico moderno.',
    precios: { monthly: 799, annual: 599 },
    features: [
      { label: 'Pacientes ilimitados', ok: true },
      { label: '1 médico + 1 asistente', ok: true },
      { label: 'Citas y expediente completo', ok: true },
      { label: 'Nota SOAP + historia clínica NOM-004', ok: true },
      { label: 'Valeria (recepcionista IA)', ok: true },
      { label: 'AI Scribe (dictado)', ok: true },
      { label: 'Papelería personalizada', ok: true },
      { label: 'Cobros online (MercadoPago, PayPal)', ok: true },
      { label: 'Soporte prioritario', ok: false },
    ],
  },
  {
    id: 'clinica',
    nombre: 'Clínica',
    desc: 'Para clínicas con múltiples médicos y especialidades.',
    precios: { monthly: 2499, annual: 1999 },
    features: [
      { label: 'Pacientes ilimitados', ok: true },
      { label: 'Hasta 20 médicos', ok: true },
      { label: 'Todo lo de Pro', ok: true },
      { label: 'Panel de administración', ok: true },
      { label: 'Reportes normativos', ok: true },
      { label: 'Múltiples Valerias por especialidad', ok: true },
      { label: 'Integración Google (Calendar & Sheets)', ok: true },
      { label: 'Facturación electrónica (CFDI)', ok: true },
      { label: 'Soporte prioritario 24/7', ok: true },
    ],
  },
];

const FEATURES_PLAN = {
  basico: [
    { label: 'Hasta 50 pacientes', icon: '👥' },
    { label: '1 médico', icon: '👤' },
    { label: 'Citas básicas', icon: '📅' },
    { label: 'Nota SOAP', icon: '📋' },
  ],
  pro: [
    { label: 'Pacientes ilimitados', icon: '👥' },
    { label: '1 médico + asistente', icon: '👥' },
    { label: 'Valeria IA', icon: '🤖' },
    { label: 'AI Scribe', icon: '🎙' },
    { label: 'Cobros online', icon: '💳' },
    { label: 'Papelería personalizada', icon: '📄' },
  ],
  clinica: [
    { label: 'Hasta 20 médicos', icon: '🏥' },
    { label: 'Panel admin', icon: '⚙️' },
    { label: 'Reportes normativos', icon: '📈' },
    { label: 'Soporte 24/7', icon: '🛟' },
    { label: 'Facturación CFDI', icon: '🧾' },
    { label: 'Multi-Valeria', icon: '🤖' },
  ],
};

const STATUS_LABELS = {
  active: 'Activo',
  trialing: 'Prueba gratuita',
  past_due: 'Pago pendiente',
  cancelled: 'Cancelado',
};

const CFDI_USOS = [
  { value: 'D10', label: 'D10 — Pagos por servicios educativos' },
  { value: 'G03', label: 'G03 — Gastos en general' },
  { value: 'P01', label: 'P01 — Por definir' },
];

const REGIMENES = [
  { value: '605', label: '605 — Sueldos y Salarios' },
  { value: '606', label: '606 — Arrendamiento' },
  { value: '612', label: '612 — Personas Físicas con Actividades Empresariales' },
  { value: '616', label: '616 — Sin obligaciones fiscales' },
  { value: '621', label: '621 — Incorporación Fiscal' },
  { value: '626', label: '626 — Régimen Simplificado de Confianza (RESICO)' },
];

// ══════════════════════════════════════════════════════════════
export default function PlanesPage() {
  const [tab, setTab] = useState('plan');
  const [data, setData] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/planes/mi-plan'),
      api.get('/api/planes/historial'),
    ]).then(([planRes, histRes]) => {
      setData(planRes.data);
      setFacturas(histRes.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const TABS = [
    { id: 'plan',        label: 'Plan actual' },
    { id: 'cambiar',     label: 'Cambiar plan' },
    { id: 'historial',   label: 'Pagos y facturas' },
    { id: 'facturacion', label: 'Datos de facturación' },
  ];

  if (loading) {
    return (
      <div className="nota-layout"><Sidebar />
        <div className="nota-main"><Navbar title="Planes y pagos" />
          <div className="nota-content" style={{color:'var(--ink-40)',paddingTop:'3rem',textAlign:'center'}}>Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Planes y pagos" />
        <div className="nota-content">

          <div className="page-header">
            <div>
              <h1 className="page-title">Planes y pagos</h1>
              <p className="page-subtitle">Administra tu suscripción, pagos y datos de facturación</p>
            </div>
          </div>

          <div className="ayuda-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`ayuda-tab ${tab === t.id ? 'ayuda-tab--active' : ''}`}
                onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === 'plan'        && <PlanActualTab sub={data?.subscription} onCambiar={() => setTab('cambiar')} />}
          {tab === 'cambiar'     && <CambiarPlanTab sub={data?.subscription} setData={setData} onDone={() => setTab('plan')} />}
          {tab === 'historial'   && <HistorialTab facturas={facturas} />}
          {tab === 'facturacion' && <FacturacionTab fac={data?.facturacion} setData={setData} />}

        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PLAN ACTUAL
// ══════════════════════════════════════════════════════════════
function PlanActualTab({ sub, onCambiar }) {
  if (!sub) return <div className="plan-empty"><div className="plan-empty__icon">📋</div><p>Sin información de plan</p></div>;

  const plan = PLANES.find(p => p.id === sub.plan) || PLANES[0];
  const features = FEATURES_PLAN[sub.plan] || [];
  const statusLabel = STATUS_LABELS[sub.status] || sub.status;
  const renewDate = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <>
      {/* Card principal */}
      <div className="plan-actual-card">
        <div className="plan-actual-card__left">
          <div className="plan-actual-card__eyebrow">Plan activo</div>
          <div className="plan-actual-card__name">{plan.nombre}</div>
          <div className="plan-actual-card__desc">{plan.desc}</div>
        </div>
        <div className="plan-actual-card__right">
          <span className={`plan-badge plan-badge--${sub.status}`}>{statusLabel}</span>
          {sub.plan !== 'basico' && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 300, color: 'var(--cream)', lineHeight: 1 }}>
                ${sub.billing_period === 'annual' ? PLANES.find(p=>p.id===sub.plan)?.precios.annual : PLANES.find(p=>p.id===sub.plan)?.precios.monthly}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-40)', marginLeft: '0.3rem' }}>
                MXN/{sub.billing_period === 'annual' ? 'mes (anual)' : 'mes'}
              </span>
            </div>
          )}
          {sub.plan === 'basico' && (
            <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 300, color: 'var(--cream)' }}>Gratis</span>
          )}
          {renewDate && <div className="plan-actual-card__renew">Próximo cobro: {renewDate}</div>}
        </div>
      </div>

      {/* Funciones incluidas */}
      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
        Incluido en tu plan
      </p>
      <div className="plan-features-grid" style={{ marginBottom: '2rem' }}>
        {features.map((f, i) => (
          <div key={i} className="plan-feature-item">
            <span className="plan-feature-item__icon">{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>

      {/* CTA */}
      {sub.plan !== 'clinica' && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button onClick={onCambiar}>Mejorar plan</Button>
          {sub.plan !== 'basico' && (
            <Button variant="ghost" style={{ color: 'var(--error)', fontSize: '0.82rem' }}>
              Cancelar suscripción
            </Button>
          )}
        </div>
      )}

      {sub.status === 'trialing' && (
        <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: 'var(--forest-soft)', borderRadius: 10, border: '0.5px solid var(--forest-lite)', fontSize: '0.85rem', color: 'var(--forest-mid)', lineHeight: 1.6 }}>
          <strong>Período de prueba activo.</strong> Explora todas las funciones de Nōta sin costo. Al terminar el período, continuarás en el plan Básico a menos que actualices.
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// CAMBIAR PLAN
// ══════════════════════════════════════════════════════════════
function CambiarPlanTab({ sub, setData, onDone }) {
  const [period, setPeriod] = useState('monthly');
  const [confirm, setConfirm] = useState(null); // plan a confirmar
  const [loading, setLoading] = useState(false);
  const currentPlan = sub?.plan || 'basico';

  async function handleCambiar() {
    if (!confirm) return;
    setLoading(true);
    try {
      const res = await api.put('/api/planes/cambiar', { plan: confirm.id, billing_period: period });
      setData(prev => ({ ...prev, subscription: res.data.data }));
      setConfirm(null);
      onDone();
    } catch(e) {} finally { setLoading(false); }
  }

  function getPrecio(plan) {
    if (plan.id === 'basico') return 'Gratis';
    const p = period === 'annual' ? plan.precios.annual : plan.precios.monthly;
    return `$${p.toLocaleString()} MXN/mes`;
  }

  function getBtnText(plan) {
    if (plan.id === currentPlan) return 'Plan actual';
    const order = ['basico', 'pro', 'clinica'];
    return order.indexOf(plan.id) > order.indexOf(currentPlan) ? 'Mejorar a ' + plan.nombre : 'Cambiar a ' + plan.nombre;
  }

  function getBtnStyle(plan) {
    if (plan.id === currentPlan) return 'outline';
    if (plan.popular) return 'ghost';
    return 'outline';
  }

  return (
    <>
      {/* Toggle mensual/anual */}
      <div className="pricing-toggle">
        <span className={`pricing-toggle__label ${period === 'monthly' ? 'pricing-toggle__label--active' : ''}`}>Mensual</span>
        <label className="config-toggle" style={{ position: 'relative' }}>
          <input type="checkbox" checked={period === 'annual'} onChange={e => setPeriod(e.target.checked ? 'annual' : 'monthly')}
            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
          <span className="config-toggle__track" />
        </label>
        <span className={`pricing-toggle__label ${period === 'annual' ? 'pricing-toggle__label--active' : ''}`}>
          Anual <span className="pricing-toggle__save">Ahorra 25%</span>
        </span>
      </div>

      <div className="pricing-grid">
        {PLANES.map(plan => (
          <div key={plan.id} className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''} ${plan.id === currentPlan ? 'pricing-card--current' : ''}`}>
            {plan.popular && <div className="pricing-card__popular-badge">⭐ Más popular</div>}
            {plan.id === currentPlan && <div className="pricing-card__current-badge">Tu plan</div>}

            <div>
              <div className="pricing-card__name">{plan.nombre}</div>
              <div className="pricing-card__price">
                {plan.id === 'basico' ? (
                  <span className="pricing-card__amount" style={{ fontSize: '2rem' }}>Gratis</span>
                ) : (
                  <>
                    <span className="pricing-card__currency">$</span>
                    <span className="pricing-card__amount">
                      {(period === 'annual' ? plan.precios.annual : plan.precios.monthly).toLocaleString()}
                    </span>
                    <span className="pricing-card__period">&nbsp;MXN/mes</span>
                  </>
                )}
              </div>
              <div className="pricing-card__desc">{plan.desc}</div>
            </div>

            <div className="pricing-card__features">
              {plan.features.map((f, i) => (
                <div key={i} className={`pricing-feat ${!f.ok ? 'pricing-feat--no' : ''}`}>
                  {f.ok
                    ? <span className="pricing-feat__check">✓</span>
                    : <span className="pricing-feat__x">✕</span>
                  }
                  {f.label}
                </div>
              ))}
            </div>

            <button
              className={`pricing-card__btn pricing-card__btn--${plan.id === currentPlan ? 'outline' : plan.popular ? 'ghost' : 'outline'}`}
              disabled={plan.id === currentPlan}
              onClick={() => plan.id !== currentPlan && setConfirm(plan)}
            >
              {getBtnText(plan)}
            </button>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--ink-40)', textAlign: 'center' }}>
        Todos los precios incluyen IVA. Puedes cancelar en cualquier momento.
      </p>

      {/* Modal de confirmación */}
      {confirm && (
        <div className="plan-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="plan-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="plan-confirm-modal__icon">📋</div>
            <div className="plan-confirm-modal__title">Cambiar a {confirm.nombre}</div>
            <div className="plan-confirm-modal__desc">
              {confirm.id === 'basico'
                ? 'Al cambiar al plan Básico perderás acceso a Valeria, AI Scribe y otras funciones Pro. ¿Continuar?'
                : `Tu plan cambiará a <strong>${confirm.nombre}</strong> por ${getPrecio(confirm)}. Se generará un cobro al método de pago registrado.`
              }
            </div>
            <div className="plan-confirm-modal__actions">
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button onClick={handleCambiar} disabled={loading}>
                {loading ? 'Procesando...' : 'Confirmar cambio'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// HISTORIAL DE PAGOS
// ══════════════════════════════════════════════════════════════
function HistorialTab({ facturas }) {
  if (facturas.length === 0) {
    return (
      <div className="plan-empty">
        <div className="plan-empty__icon">🧾</div>
        <p style={{ fontWeight: 500, color: 'var(--ink)', marginBottom: '0.35rem' }}>Sin historial de pagos</p>
        <p style={{ fontSize: '0.85rem' }}>Aquí aparecerán tus facturas y comprobantes de pago.</p>
      </div>
    );
  }

  return (
    <div className="pagos-table-wrap">
      <table className="pagos-table">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Fecha</th>
            <th>Concepto</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Factura</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map(f => (
            <tr key={f.id}>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--ink-40)' }}>
                {f.folio || '—'}
              </td>
              <td style={{ color: 'var(--ink-40)', fontSize: '0.82rem' }}>
                {new Date(f.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td>{f.concepto || 'Suscripción Nōta'}</td>
              <td>
                <span className="pago-amount">
                  ${parseFloat(f.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {f.currency || 'MXN'}
                </span>
              </td>
              <td>
                <span className={`pago-status pago-status--${f.status}`}>
                  {f.status === 'pagado' ? '✓ Pagado' : f.status === 'pendiente' ? '⏳ Pendiente' : '⚠ Vencido'}
                </span>
              </td>
              <td>
                {f.pdf_url
                  ? <a href={f.pdf_url} target="_blank" rel="noreferrer" className="pago-dl">↓ PDF</a>
                  : <span style={{ color: 'var(--ink-40)', fontSize: '0.78rem' }}>—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DATOS DE FACTURACIÓN
// ══════════════════════════════════════════════════════════════
function FacturacionTab({ fac, setData }) {
  const [form, setForm] = useState({
    rfc: fac?.rfc || '',
    razon_social: fac?.razon_social || '',
    uso_cfdi: fac?.uso_cfdi || 'D10',
    regimen_fiscal: fac?.regimen_fiscal || '626',
    billing_email: fac?.billing_email || fac?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      const res = await api.put('/api/planes/facturacion', form);
      setData(prev => ({ ...prev, facturacion: { ...prev?.facturacion, ...res.data.data } }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) {} finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--ink-40)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        Estos datos se usan para generar tu CFDI cada vez que se procesa un pago. Asegúrate de que coincidan exactamente con los registrados ante el SAT.
      </p>

      <div className="facturacion-form">
        <div className="fac-grid">
          <div className="fac-field">
            <label className="fac-label">RFC</label>
            <input className="fac-input" value={form.rfc}
              onChange={e => setForm(p => ({...p, rfc: e.target.value.toUpperCase()}))}
              placeholder="XAXX010101000" maxLength={13} />
          </div>
          <div className="fac-field">
            <label className="fac-label">Correo para facturas</label>
            <input className="fac-input" type="email" value={form.billing_email}
              onChange={e => setForm(p => ({...p, billing_email: e.target.value}))}
              placeholder="facturacion@correo.com" />
          </div>
          <div className="fac-field fac-full">
            <label className="fac-label">Razón social</label>
            <input className="fac-input" value={form.razon_social}
              onChange={e => setForm(p => ({...p, razon_social: e.target.value.toUpperCase()}))}
              placeholder="TAL CUAL ESTÁ EN EL SAT (mayúsculas)" />
          </div>
          <div className="fac-field">
            <label className="fac-label">Uso de CFDI</label>
            <div className="fac-select-wrap">
              <select className="fac-select" value={form.uso_cfdi}
                onChange={e => setForm(p => ({...p, uso_cfdi: e.target.value}))}>
                {CFDI_USOS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div className="fac-field">
            <label className="fac-label">Régimen fiscal</label>
            <div className="fac-select-wrap">
              <select className="fac-select" value={form.regimen_fiscal}
                onChange={e => setForm(p => ({...p, regimen_fiscal: e.target.value}))}>
                {REGIMENES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="fac-note">
          💡 <strong>Importante:</strong> La razón social y el RFC deben coincidir exactamente con tu constancia de situación fiscal. Un error generará un CFDI inválido.
        </div>

        {saved && (
          <div style={{ marginTop: '0.75rem', color: 'var(--forest-mid)', fontSize: '0.83rem', fontWeight: 500 }}>
            ✓ Datos de facturación guardados
          </div>
        )}

        <div className="planes-actions">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar datos fiscales'}
          </Button>
        </div>
      </div>
    </div>
  );
}
