import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import api from '../services/api';
import '../styles/agenda.css';

// ─── Constantes ───────────────────────────────────────────────
const HOUR_START = 7;   // 7 AM
const HOUR_END   = 21;  // 9 PM
const SLOT_H     = 64;  // px por hora en day view
const WEEK_SLOT_H= 48;  // px por hora en week view
const DAYS_ES    = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Paleta de colores por médico (se asigna por índice)
const DOCTOR_PALETTE = [
  '#2D5A3D', // forest green
  '#1D4ED8', // blue
  '#7C3AED', // purple
  '#0891B2', // cyan
  '#D97706', // amber
  '#DB2777', // pink
  '#059669', // emerald
  '#DC2626', // red
];

const STATUS_COLORS = {
  scheduled:   { bg:'var(--forest-soft)', color:'var(--forest-mid)', border:'var(--forest-mid)', accent:'#2D5A3D' },
  confirmed:   { bg:'#EFF6FF', color:'#1D4ED8', border:'#3B82F6', accent:'#3B82F6' },
  waiting:     { bg:'#FEF3C7', color:'#92400E', border:'#D97706', accent:'#D97706' },
  in_progress: { bg:'#F3E8FF', color:'#7C3AED', border:'#8B5CF6', accent:'#8B5CF6' },
  completed:   { bg:'var(--forest-soft)', color:'var(--forest-mid)', border:'var(--forest-lite)', accent:'var(--forest-mid)' },
  cancelled:   { bg:'#F9FAFB', color:'var(--ink-40)', border:'var(--ink-15)', accent:'var(--ink-40)' },
  no_show:     { bg:'var(--error-soft)', color:'var(--error)', border:'#FCA5A5', accent:'var(--error)' },
};

const STATUS_LABELS = {
  scheduled:   '⏰ Agendada',
  confirmed:   '✓ Confirmada',
  waiting:     '🟡 En sala',
  in_progress: '🟣 En consulta',
  completed:   '✅ Completada',
  cancelled:   '✕ Cancelada',
  no_show:     '👻 No se presentó',
};

// ─── Helpers ─────────────────────────────────────────────────
function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h % 12 || 12}:${String(min).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function formatPeriodLabel(date, view) {
  const d = new Date(date + 'T12:00:00');
  if (view === 'day') {
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (view === 'week') {
    const dow = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.getDate()} – ${sun.getDate()} ${MONTHS_ES[sun.getMonth()]} ${sun.getFullYear()}`;
  }
  return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function navigateDate(date, view, dir) {
  const d = new Date(date + 'T12:00:00');
  if (view === 'day')   d.setDate(d.getDate() + dir);
  if (view === 'week')  d.setDate(d.getDate() + dir * 7);
  if (view === 'month') d.setMonth(d.getMonth() + dir);
  return d.toISOString().split('T')[0];
}

function getWeekDays(date) {
  const d = new Date(date + 'T12:00:00');
  const dow = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon); day.setDate(mon.getDate() + i);
    return day.toISOString().split('T')[0];
  });
}

function getMonthDays(date) {
  const d = new Date(date + 'T12:00:00');
  const year = d.getFullYear(), month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const offset   = startDow === 0 ? 6 : startDow - 1; // monday first
  const days = [];
  for (let i = offset; i > 0; i--) {
    const day = new Date(firstDay); day.setDate(1 - i);
    days.push({ date: day.toISOString().split('T')[0], otherMonth: true });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`, otherMonth: false });
  }
  while (days.length % 7 !== 0) {
    const last = new Date(lastDay); last.setDate(lastDay.getDate() + days.length - lastDay.getDate() - offset);
    days.push({ date: last.toISOString().split('T')[0], otherMonth: true });
  }
  return days;
}

function waitLabel(minutes) {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes}min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function waitClass(minutes) {
  if (minutes === null) return '';
  if (minutes < 20) return 'waiting-card__wait--ok';
  if (minutes < 45) return 'waiting-card__wait--warn';
  return 'waiting-card__wait--urgent';
}

function patientName(appt) {
  if (!appt.patients) return 'Paciente';
  return [appt.patients.first_name, appt.patients.last_name].filter(Boolean).join(' ');
}

// ══════════════════════════════════════════════════════════════
export default function AgendaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [view, setView]           = useState('day');
  const [date, setDate]           = useState(todayStr());
  const [data, setData]           = useState({ appointments: [], blocks: [], kpis: {} });
  const [loading, setLoading]     = useState(true);
  const [doctors, setDoctors]     = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [newAppt, setNewAppt] = useState(null); // { date, time }
  const [nowMinutes, setNowMinutes] = useState(timeToMinutes(new Date().toTimeString().slice(0,5)));
  const timerRef = useRef();

  // Actualizar "ahora" cada minuto
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setNowMinutes(timeToMinutes(new Date().toTimeString().slice(0,5)));
    }, 60000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    api.get('/api/agenda/doctors').then(r => setDoctors(r.data.data || [])).catch(() => {});
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ date, view });
    if (selectedDoctor) params.set('doctor_id', selectedDoctor);
    api.get(`/api/agenda?${params}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date, view, selectedDoctor]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sala de espera
  const waitingAppts = data.appointments.filter(a => a.display_status === 'waiting');

  async function handleArrive(id) {
    await api.post(`/api/agenda/arrive/${id}`);
    loadData();
  }

  async function handleStatus(id, status) {
    await api.post(`/api/agenda/status/${id}`, { status });
    setSelectedAppt(null);
    loadData();
  }

  const isSecretary = user?.role === 'secretary' || user?.role === 'admin';

  // Mapa doctor_id → color de la paleta
  const doctorColorMap = Object.fromEntries(
    doctors.map((d, i) => [d.id, DOCTOR_PALETTE[i % DOCTOR_PALETTE.length]])
  );

  // Scroll al horario actual en day view
  const slotsRef = useRef();
  useEffect(() => {
    if (view === 'day' && slotsRef.current && date === todayStr()) {
      const scrollTo = (nowMinutes - HOUR_START * 60) * (SLOT_H / 60) - 80;
      slotsRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [view, date, nowMinutes]);

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Agenda" actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowReminders(true)}>📱 Recordatorios</Button>
            <Button variant="secondary" onClick={() => setShowBlockForm(true)}>🚫 Bloquear horario</Button>
            <Button onClick={() => navigate('/appointments')}>+ Nueva cita</Button>
          </div>
        } />

        <div className="agenda-layout">
          {/* ── Toolbar ── */}
          <div className="agenda-toolbar">
            <div className="agenda-toolbar__nav">
              <button className="agenda-nav-btn" onClick={() => setDate(d => navigateDate(d, view, -1))}>‹</button>
              <button className="agenda-today-btn" onClick={() => setDate(todayStr())}>Hoy</button>
              <button className="agenda-nav-btn" onClick={() => setDate(d => navigateDate(d, view, 1))}>›</button>
            </div>
            <span className="agenda-period-label" style={{ textTransform: 'capitalize' }}>
              {formatPeriodLabel(date, view)}
            </span>
            {doctors.length > 1 && (
              <select className="agenda-doctor-select" value={selectedDoctor}
                onChange={e => setSelectedDoctor(e.target.value)}>
                <option value="">Todos los médicos</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
                ))}
              </select>
            )}
            <div className="agenda-view-toggle">
              {['day','week','month'].map(v => (
                <button key={v} className={`agenda-view-btn ${view === v ? 'agenda-view-btn--active' : ''}`}
                  onClick={() => setView(v)}>
                  {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>

          {/* ── KPI Bar ── */}
          {!loading && (
            <div className="agenda-kpis">
              <div className="agenda-kpi"><span className="agenda-kpi__num">{data.kpis.total||0}</span><span className="agenda-kpi__label">Total</span></div>
              <div className="agenda-kpi"><span className="agenda-kpi__num">{data.kpis.agendadas||0}</span><span className="agenda-kpi__label">Agendadas</span></div>
              <div className="agenda-kpi agenda-kpi--sala"><span className="agenda-kpi__num">{data.kpis.en_sala||0}</span><span className="agenda-kpi__label">En sala</span></div>
              <div className="agenda-kpi"><span className="agenda-kpi__num">{data.kpis.en_consulta||0}</span><span className="agenda-kpi__label">En consulta</span></div>
              <div className="agenda-kpi agenda-kpi--ok"><span className="agenda-kpi__num">{data.kpis.completadas||0}</span><span className="agenda-kpi__label">Completadas</span></div>
              <div className="agenda-kpi agenda-kpi--cancel"><span className="agenda-kpi__num">{data.kpis.canceladas||0}</span><span className="agenda-kpi__label">Canceladas</span></div>
              <div className="agenda-kpi"><span className="agenda-kpi__num">{data.kpis.no_show||0}</span><span className="agenda-kpi__label">No se presentó</span></div>
              <div className="agenda-kpi agenda-kpi--first"><span className="agenda-kpi__num">{data.kpis.primera_vez||0}</span><span className="agenda-kpi__label">Primera vez</span></div>
              <div className="agenda-kpi"><span className="agenda-kpi__num">{data.kpis.recurrentes||0}</span><span className="agenda-kpi__label">Recurrentes</span></div>
            </div>
          )}

          {/* ── Cuerpo ── */}
          <div className="agenda-body">
            {/* Sala de espera */}
            {view === 'day' && (
              <div className="agenda-waiting">
                <div className="agenda-waiting__header">
                  <span className="agenda-waiting__title">Sala de espera</span>
                  {waitingAppts.length > 0 && <span className="agenda-waiting__count">{waitingAppts.length}</span>}
                </div>
                <div className="agenda-waiting__list">
                  {waitingAppts.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--ink-40)', textAlign: 'center', padding: '1rem 0' }}>
                      Sin pacientes en sala
                    </p>
                  ) : (
                    waitingAppts
                      .sort((a, b) => (a.wait_minutes || 0) < (b.wait_minutes || 0) ? 1 : -1)
                      .map(appt => (
                        <div key={appt.id} className={`waiting-card ${(appt.wait_minutes||0) >= 45 ? 'waiting-card--urgent' : ''}`}
                          onClick={() => setSelectedAppt(appt)}>
                          <div className="waiting-card__name">{patientName(appt)}</div>
                          <div className="waiting-card__time">
                            <span>{minutesToTime(appt.start_minutes)}</span>
                            {appt.wait_minutes !== null && (
                              <span className={`waiting-card__wait ${waitClass(appt.wait_minutes)}`}>
                                ⏱ {waitLabel(appt.wait_minutes)}
                              </span>
                            )}
                          </div>
                          <div className="waiting-card__actions">
                            <button className="waiting-action-btn waiting-action-btn--green"
                              onClick={e => { e.stopPropagation(); handleStatus(appt.id, 'in_progress'); }}>
                              → Pasar
                            </button>
                            <button className="waiting-action-btn waiting-action-btn--red"
                              onClick={e => { e.stopPropagation(); handleStatus(appt.id, 'no_show'); }}>
                              No vino
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* Calendario */}
            <div className="agenda-calendar">
              {loading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-40)' }}>
                  Cargando agenda...
                </div>
              )}
              {!loading && view === 'day'   && <DayView   date={date} appointments={data.appointments} blocks={data.blocks} nowMinutes={nowMinutes} slotsRef={slotsRef} onApptClick={setSelectedAppt} onArrive={handleArrive} onSlotClick={(d,t) => setNewAppt({ date: d, time: t })} />}
              {!loading && view === 'week'  && <WeekView  date={date} appointments={data.appointments} blocks={data.blocks} nowMinutes={nowMinutes} onApptClick={setSelectedAppt} onDayClick={d => { setDate(d); setView('day'); }} doctorColors={doctorColorMap} multiDoctor={!selectedDoctor && doctors.length > 1} onSlotClick={(d,t) => setNewAppt({ date: d, time: t })} />}
              {!loading && view === 'month' && <MonthView date={date} appointments={data.appointments} onApptClick={setSelectedAppt} onDayClick={d => { setDate(d); setView('day'); }} doctorColors={doctorColorMap} multiDoctor={!selectedDoctor && doctors.length > 1} />}
            </div>
          </div>
        </div>
      </div>

      {/* Panel detalle de cita */}
      {selectedAppt && (
        <ApptDetail
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onStatus={handleStatus}
          onArrive={handleArrive}
          isSecretary={isSecretary}
          navigate={navigate}
        />
      )}

      {/* Panel nueva cita */}
      {newAppt && (
        <NewApptPanel
          date={newAppt.date}
          time={newAppt.time}
          doctors={doctors}
          defaultDoctorId={selectedDoctor}
          onClose={() => setNewAppt(null)}
          onSaved={() => { setNewAppt(null); loadData(); }}
        />
      )}

      {/* Modal recordatorios */}
      {showReminders && (
        <ReminderModal onClose={() => setShowReminders(false)} />
      )}

      {/* Modal bloquear horario */}
      {showBlockForm && (
        <BlockForm
          defaultDate={date}
          doctors={doctors}
          onSave={async (block) => {
            await api.post('/api/agenda/blocks', block);
            setShowBlockForm(false);
            loadData();
          }}
          onClose={() => setShowBlockForm(false)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VISTA DÍA
// ══════════════════════════════════════════════════════════════
function DayView({ date, appointments, blocks, nowMinutes, slotsRef, onApptClick, onArrive, onSlotClick }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const todayAppts = appointments.filter(a => a.appointment_date === date);
  const todayBlocks = blocks.filter(b => b.date === date);
  const isToday = date === todayStr();

  function apptStyle(appt) {
    const start = timeToMinutes(appt.start_time);
    const end   = timeToMinutes(appt.end_time || appt.start_time) + 30;
    const top   = (start - HOUR_START * 60) * (SLOT_H / 60);
    const height= Math.max((end - start) * (SLOT_H / 60), 28);
    return { top, height };
  }

  function blockStyle(b) {
    const start = timeToMinutes(b.start_time);
    const end   = timeToMinutes(b.end_time);
    const top   = (start - HOUR_START * 60) * (SLOT_H / 60);
    const height= Math.max((end - start) * (SLOT_H / 60), 20);
    return { top, height };
  }

  const nowTop = isToday ? (nowMinutes - HOUR_START * 60) * (SLOT_H / 60) : null;

  return (
    <div className="day-view">
      {/* Timeline de horas */}
      <div className="day-timeline">
        {hours.map(h => (
          <div key={h} className="day-hour" style={{ height: SLOT_H }}>
            <div className="day-hour-label">{h % 12 || 12}{h < 12 ? 'am' : 'pm'}</div>
          </div>
        ))}
      </div>

      {/* Slots de citas */}
      <div className="day-slots" ref={slotsRef} style={{ position: 'relative' }}
        onClick={e => {
          if (e.target.closest('.day-appt') || e.target.closest('.day-block')) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top + e.currentTarget.scrollTop;
          const totalMin = Math.round(y / (SLOT_H / 60) + HOUR_START * 60);
          const snapped = Math.round(totalMin / 30) * 30;
          const hh = Math.floor(snapped / 60);
          const mm = snapped % 60;
          if (hh >= HOUR_START && hh < HOUR_END) {
            onSlotClick(date, `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
          }
        }}>
        {hours.map(h => (
          <div key={h} className="day-hour" style={{ height: SLOT_H }}>
            <div className="day-hour-half" />
          </div>
        ))}

        {/* Línea de "ahora" */}
        {nowTop !== null && nowTop >= 0 && (
          <div className="day-now-line" style={{ top: nowTop }} />
        )}

        {/* Bloques */}
        {todayBlocks.map(b => (
          <div key={b.id} className="day-block"
            style={{ ...blockStyle(b), background: b.color + '22', borderColor: b.color, color: b.color }}>
            🚫 {b.title}
          </div>
        ))}

        {/* Citas */}
        {todayAppts.map(appt => {
          const st = apptStyle(appt);
          const sc = STATUS_COLORS[appt.display_status] || STATUS_COLORS.scheduled;
          return (
            <div key={appt.id} className="day-appt"
              style={{ ...st, background: sc.bg, color: sc.color, borderLeftColor: sc.border }}
              onClick={() => onApptClick(appt)}>
              <div className="day-appt__time">{minutesToTime(appt.start_minutes)}</div>
              <div className="day-appt__name">{patientName(appt)}</div>
              {appt.reason && <div className="day-appt__reason">{appt.reason}</div>}
              <div className="day-appt__badges">
                <span className={`appt-badge appt-badge--${appt.is_first_visit ? 'primera' : 'recurrente'}`}>
                  {appt.is_first_visit ? '★ 1a vez' : '↩ Recurrente'}
                </span>
                {appt.display_status === 'waiting' && (
                  <span className="appt-badge" style={{ color: '#92400E' }}>⏱ En sala</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VISTA SEMANA
// ══════════════════════════════════════════════════════════════
function WeekView({ date, appointments, blocks, nowMinutes, onApptClick, onDayClick, doctorColors = {}, multiDoctor = false, onSlotClick }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const weekDays = getWeekDays(date);
  const today = todayStr();

  function apptStyle(appt) {
    const start = timeToMinutes(appt.start_time);
    const end   = timeToMinutes(appt.end_time || appt.start_time) + 30;
    const top   = (start - HOUR_START * 60) * (WEEK_SLOT_H / 60);
    const height= Math.max((end - start) * (WEEK_SLOT_H / 60), 22);
    return { top, height };
  }

  const nowTop = (nowMinutes - HOUR_START * 60) * (WEEK_SLOT_H / 60);
  const todayIdx = weekDays.indexOf(today);

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="week-header__spacer" />
        {weekDays.map((d, i) => {
          const dd = new Date(d + 'T12:00:00');
          return (
            <div key={d} className={`week-day-header ${d === today ? 'week-day-header--today' : ''}`}
              style={{ cursor: 'pointer' }} onClick={() => onDayClick(d)}>
              <div className="week-day-header__name">{DAYS_ES[dd.getDay()]}</div>
              <div className="week-day-header__num">{dd.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="week-body">
        <div className="week-timeline">
          {hours.map(h => (
            <div key={h} className="week-hour-row" style={{ height: WEEK_SLOT_H }}>
              <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-40)', padding: '3px 4px' }}>
                {h % 12 || 12}{h < 12 ? 'am' : 'pm'}
              </div>
            </div>
          ))}
        </div>
        <div className="week-days">
          {weekDays.map((d, colIdx) => {
            const dayAppts = appointments.filter(a => a.appointment_date === d);
            return (
              <div key={d} className={`week-day-col ${d === today ? 'week-day-col--today' : ''}`}
                onClick={e => {
                  if (e.target.closest('.week-appt')) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const totalMin = Math.round(y / (WEEK_SLOT_H / 60) + HOUR_START * 60);
                  const snapped = Math.round(totalMin / 30) * 30;
                  const hh = Math.floor(snapped / 60);
                  const mm = snapped % 60;
                  if (hh >= HOUR_START && hh < HOUR_END) {
                    onSlotClick(d, `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
                  }
                }}>
                {hours.map(h => <div key={h} className="week-hour-row" style={{ height: WEEK_SLOT_H }} />)}
                {/* Línea de ahora */}
                {d === today && nowTop >= 0 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 2, background: 'var(--error)', zIndex: 10, pointerEvents: 'none' }} />
                )}
                {dayAppts.map(appt => {
                  const st = apptStyle(appt);
                  const sc = STATUS_COLORS[appt.display_status] || STATUS_COLORS.scheduled;
                  const doctorColor = multiDoctor && appt.doctor_id ? doctorColors[appt.doctor_id] : null;
                  return (
                    <div key={appt.id} className="week-appt"
                      style={{ ...st, background: sc.bg, color: sc.color, borderLeftColor: doctorColor || sc.border }}
                      onClick={() => onApptClick(appt)}>
                      {doctorColor && (
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: doctorColor, marginRight: 3, flexShrink: 0 }} />
                      )}
                      <div className="week-appt__name">{patientName(appt)}</div>
                      <div className="week-appt__time">{minutesToTime(timeToMinutes(appt.start_time))}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VISTA MES
// ══════════════════════════════════════════════════════════════
function MonthView({ date, appointments, onApptClick, onDayClick, doctorColors = {}, multiDoctor = false }) {
  const days = getMonthDays(date);
  const today = todayStr();

  const apptsByDate = {};
  appointments.forEach(a => {
    if (!apptsByDate[a.appointment_date]) apptsByDate[a.appointment_date] = [];
    apptsByDate[a.appointment_date].push(a);
  });

  return (
    <div className="month-view">
      <div className="month-header">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="month-dow">{d}</div>
        ))}
      </div>
      <div className="month-grid">
        {days.map(({ date: d, otherMonth }) => {
          const dayAppts = apptsByDate[d] || [];
          const visible  = dayAppts.slice(0, 3);
          const more     = dayAppts.length - 3;
          return (
            <div key={d} className={`month-cell ${otherMonth ? 'month-cell--other-month' : ''} ${d === today ? 'month-cell--today' : ''}`}
              onClick={() => !otherMonth && onDayClick(d)}>
              <div className="month-cell__num">{new Date(d + 'T12:00:00').getDate()}</div>
              {visible.map(appt => {
                const sc = STATUS_COLORS[appt.display_status] || STATUS_COLORS.scheduled;
                const doctorColor = multiDoctor && appt.doctor_id ? doctorColors[appt.doctor_id] : null;
                return (
                  <div key={appt.id} className="month-appt-pill"
                    style={{ background: sc.bg, color: sc.color, borderLeftColor: doctorColor || sc.border, borderLeftWidth: 3, borderLeftStyle: 'solid' }}
                    onClick={e => { e.stopPropagation(); onApptClick(appt); }}>
                    {doctorColor && (
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: doctorColor, marginRight: 3, flexShrink: 0, verticalAlign: 'middle' }} />
                    )}
                    {minutesToTime(timeToMinutes(appt.start_time))} {patientName(appt)}
                  </div>
                );
              })}
              {more > 0 && <div className="month-more">+{more} más</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PANEL DETALLE DE CITA
// ══════════════════════════════════════════════════════════════
function ApptDetail({ appt, onClose, onStatus, onArrive, isSecretary, navigate }) {
  const sc = STATUS_COLORS[appt.display_status] || STATUS_COLORS.scheduled;
  const name = patientName(appt);
  const isWaiting = appt.display_status === 'waiting';
  const isActive  = ['scheduled','confirmed','waiting'].includes(appt.display_status);

  const [upcoming, setUpcoming] = useState([]);
  useEffect(() => {
    if (!appt.patient_id) return;
    api.get(`/api/agenda/patient/${appt.patient_id}/upcoming`)
      .then(r => setUpcoming((r.data.data || []).filter(u => u.id !== appt.id)))
      .catch(() => {});
  }, [appt.id, appt.patient_id]);

  const statusActions = [];
  if (!appt.arrived_at && isActive) statusActions.push({ label: '🚪 Registrar llegada', action: () => onArrive(appt.id) });
  if (appt.display_status !== 'in_progress' && isActive) statusActions.push({ label: '→ Pasar a consulta', action: () => onStatus(appt.id, 'in_progress') });
  if (appt.display_status !== 'completed' && !['cancelled','no_show'].includes(appt.display_status)) statusActions.push({ label: '✅ Marcar completada', action: () => onStatus(appt.id, 'completed') });
  if (isActive) statusActions.push({ label: '👻 No se presentó', action: () => onStatus(appt.id, 'no_show'), danger: true });
  if (isActive) statusActions.push({ label: '✕ Cancelar cita', action: () => onStatus(appt.id, 'cancelled'), danger: true });

  return (
    <div className="appt-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="appt-detail-panel">
        <div className="appt-detail-panel__accent" style={{ background: sc.accent }} />
        <div className="appt-detail-panel__body">
          <div className="appt-detail-panel__header">
            <div>
              <div className="appt-detail-panel__name">{name}</div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 20, background: sc.bg, color: sc.color, display: 'inline-block', marginTop: 4 }}>
                {STATUS_LABELS[appt.display_status] || appt.display_status}
              </span>
            </div>
            <button className="appt-detail-panel__close" onClick={onClose}>✕</button>
          </div>

          <div className="appt-detail-rows">
            <div className="appt-detail-row">
              <span className="appt-detail-row__icon">📅</span>
              <span className="appt-detail-row__val">
                {new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div className="appt-detail-row">
              <span className="appt-detail-row__icon">⏰</span>
              <span className="appt-detail-row__val">{minutesToTime(timeToMinutes(appt.start_time))}</span>
              {appt.end_time && <span className="appt-detail-row__muted"> – {minutesToTime(timeToMinutes(appt.end_time))}</span>}
            </div>
            {appt.doctors && (
              <div className="appt-detail-row">
                <span className="appt-detail-row__icon">👨‍⚕️</span>
                <span className="appt-detail-row__val">Dr. {appt.doctors.first_name} {appt.doctors.last_name}</span>
                <span className="appt-detail-row__muted" style={{ marginLeft: 4 }}>· {appt.doctors.specialty}</span>
              </div>
            )}
            {appt.patients?.phone && (
              <div className="appt-detail-row">
                <span className="appt-detail-row__icon">📞</span>
                <span className="appt-detail-row__val">{appt.patients.phone}</span>
              </div>
            )}
            {appt.reason && (
              <div className="appt-detail-row">
                <span className="appt-detail-row__icon">📋</span>
                <span className="appt-detail-row__val">{appt.reason}</span>
              </div>
            )}
            <div className="appt-detail-row">
              <span className="appt-detail-row__icon">🏷️</span>
              <span className="appt-detail-row__val" style={{ color: appt.is_first_visit ? 'var(--forest-mid)' : 'var(--ink-40)' }}>
                {appt.is_first_visit ? '★ Primera vez' : '↩ Paciente recurrente'}
              </span>
            </div>
            {isWaiting && appt.wait_minutes !== null && (
              <div className="appt-detail-row">
                <span className="appt-detail-row__icon">⏱</span>
                <span className={`waiting-card__wait ${waitClass(appt.wait_minutes)}`} style={{ display: 'inline-block' }}>
                  Esperando: {waitLabel(appt.wait_minutes)}
                </span>
              </div>
            )}
          </div>

          {/* Próximas citas del paciente */}
          {upcoming.length > 0 && (
            <div className="appt-upcoming">
              <div className="appt-upcoming__title">Próximas citas de este paciente</div>
              {upcoming.map(u => {
                const d = new Date(u.appointment_date + 'T12:00:00');
                const label = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
                const sc2 = STATUS_COLORS[u.status] || STATUS_COLORS.scheduled;
                return (
                  <div key={u.id} className="appt-upcoming__row">
                    <span className="appt-upcoming__dot" style={{ background: sc2.accent }} />
                    <span className="appt-upcoming__date">{label}</span>
                    <span className="appt-upcoming__time">{minutesToTime(timeToMinutes(u.start_time))}</span>
                    {u.doctors && <span className="appt-upcoming__doctor">Dr. {u.doctors.last_name}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Acciones de status */}
          <div className="appt-status-actions">
            {statusActions.map((a, i) => (
              <button key={i} onClick={a.action}
                className="est-quick-btn"
                style={{ fontSize: '0.78rem', color: a.danger ? 'var(--error)' : undefined, borderColor: a.danger ? '#fecaca' : undefined }}>
                {a.label}
              </button>
            ))}
            <button className="est-quick-btn" onClick={() => navigate(`/clinical-notes/${appt.id}`)}>
              📋 Ver expediente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FORMULARIO BLOQUEAR HORARIO
// ══════════════════════════════════════════════════════════════
function BlockForm({ defaultDate, doctors, onSave, onClose }) {
  const [form, setForm] = useState({
    title: '', date: defaultDate,
    start_time: '13:00', end_time: '14:00',
    tipo: 'comida', color: '#6B7C80',
  });
  const [saving, setSaving] = useState(false);

  const TIPOS = [
    { value: 'comida',    label: '🍽 Comida',      color: '#D97706' },
    { value: 'junta',     label: '📋 Junta',        color: '#7C3AED' },
    { value: 'vacacion',  label: '🏖 Vacación',     color: '#0891B2' },
    { value: 'bloqueo',   label: '🚫 Bloqueo general', color: '#6B7C80' },
  ];

  async function handleSave() {
    if (!form.title) { alert('Ingresa un título'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="appt-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="block-form">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 className="block-form__title">Bloquear horario</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-40)', fontSize: '1.1rem' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label className="config-label">Tipo de bloqueo</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {TIPOS.map(t => (
                <button key={t.value} onClick={() => setForm(p => ({ ...p, tipo: t.value, title: form.title || t.label.replace(/^.+\s/, ''), color: t.color }))}
                  className={`est-quick-btn ${form.tipo === t.value ? 'est-quick-btn--active' : ''}`}
                  style={{ fontSize: '0.75rem' }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="config-field">
            <label className="config-label">Título</label>
            <input className="config-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej. Comida, Junta con admin..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
            <div className="config-field">
              <label className="config-label">Fecha</label>
              <input type="date" className="config-input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="config-field">
                <label className="config-label">Inicio</label>
                <input type="time" className="config-input" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="config-field">
                <label className="config-label">Fin</label>
                <input type="time" className="config-input" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '0.5px solid var(--cream-mid)' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Bloquear'}</Button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODAL RECORDATORIOS
// ══════════════════════════════════════════════════════════════
function ReminderModal({ onClose }) {
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [results, setResults]   = useState(null);

  useEffect(() => {
    api.get('/api/reminders/preview')
      .then(r => setPreview(r.data))
      .catch(() => setPreview({ data: [], twilio_configured: false, tomorrow: '' }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSend() {
    setSending(true);
    try {
      const r = await api.post('/api/reminders/send', {});
      setResults(r.data);
    } catch {
      setResults({ sent: 0, total: 0, results: [], twilio_configured: false });
    }
    setSending(false);
  }

  const tomorrow = preview?.tomorrow
    ? new Date(preview.tomorrow + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  const withPhone    = (preview?.data || []).filter(a => a.patients?.phone);
  const withoutPhone = (preview?.data || []).filter(a => !a.patients?.phone);

  return (
    <div className="appt-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="reminder-modal">
        <div className="reminder-modal__header">
          <div>
            <h3 className="reminder-modal__title">📱 Recordatorios de citas</h3>
            {!loading && <p className="reminder-modal__sub">Para mañana — <span style={{ textTransform: 'capitalize' }}>{tomorrow}</span></p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-40)', fontSize: '1.1rem' }}>✕</button>
        </div>

        {loading && <p style={{ color: 'var(--ink-40)', fontSize: '0.85rem', padding: '1rem 0' }}>Cargando...</p>}

        {!loading && !results && (
          <>
            {!preview?.twilio_configured && (
              <div className="reminder-modal__notice">
                ⚠️ Twilio no está configurado. Los recordatorios se mostrarán pero no se enviarán hasta configurar <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> y <code>TWILIO_PHONE_NUMBER</code> en el servidor.
              </div>
            )}

            {preview?.data?.length === 0 ? (
              <p style={{ color: 'var(--ink-40)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No hay citas agendadas para mañana.</p>
            ) : (
              <>
                <div className="reminder-modal__list">
                  {preview.data.map(appt => {
                    const name = [appt.patients?.first_name, appt.patients?.last_name].filter(Boolean).join(' ');
                    const phone = appt.patients?.phone;
                    const time = minutesToTime(timeToMinutes(appt.start_time));
                    const alreadySent = !!appt.reminder_sent_at;
                    return (
                      <div key={appt.id} className={`reminder-row ${!phone ? 'reminder-row--nophone' : ''}`}>
                        <div className="reminder-row__info">
                          <span className="reminder-row__name">{name || 'Paciente'}</span>
                          <span className="reminder-row__time">{time}</span>
                          {appt.doctors && <span className="reminder-row__doctor">Dr. {appt.doctors.last_name}</span>}
                        </div>
                        <div className="reminder-row__status">
                          {alreadySent
                            ? <span style={{ color: 'var(--forest-mid)', fontSize: '0.72rem', fontWeight: 600 }}>✓ Enviado</span>
                            : phone
                              ? <span style={{ color: 'var(--ink-50)', fontSize: '0.72rem' }}>{phone}</span>
                              : <span style={{ color: 'var(--error)', fontSize: '0.72rem' }}>Sin teléfono</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
                {withoutPhone.length > 0 && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--ink-40)', marginTop: '0.5rem' }}>
                    {withoutPhone.length} paciente{withoutPhone.length > 1 ? 's' : ''} sin número — no recibirán recordatorio.
                  </p>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '0.5px solid var(--cream-mid)' }}>
              <Button variant="ghost" onClick={onClose}>Cerrar</Button>
              {withPhone.length > 0 && (
                <Button onClick={handleSend} disabled={sending}>
                  {sending ? 'Enviando...' : `Enviar ${withPhone.length} recordatorio${withPhone.length > 1 ? 's' : ''}`}
                </Button>
              )}
            </div>
          </>
        )}

        {results && (
          <>
            <div className="reminder-modal__results">
              <div className="reminder-result-summary">
                <span style={{ color: 'var(--forest-mid)', fontWeight: 700, fontSize: '1.1rem' }}>{results.sent}</span>
                <span style={{ color: 'var(--ink-50)', fontSize: '0.82rem' }}>de {results.total} enviados</span>
              </div>
              {results.results.map((r, i) => (
                <div key={i} className="reminder-row">
                  <div className="reminder-row__info">
                    <span className="reminder-row__name">{r.patient}</span>
                    {r.phone && <span style={{ fontSize: '0.72rem', color: 'var(--ink-40)' }}>{r.phone}</span>}
                  </div>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    color: r.status === 'sent' ? 'var(--forest-mid)' : r.status === 'error' ? 'var(--error)' : 'var(--ink-40)'
                  }}>
                    {r.status === 'sent' ? '✓ Enviado' : r.status === 'error' ? `✕ Error` : '— Omitido'}
                  </span>
                </div>
              ))}
              {!results.twilio_configured && (
                <div className="reminder-modal__notice" style={{ marginTop: '0.75rem' }}>
                  ℹ️ Modo simulación — configura Twilio para envíos reales.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '0.5px solid var(--cream-mid)' }}>
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PANEL NUEVA CITA (click en slot del calendario)
// ══════════════════════════════════════════════════════════════
function NewApptPanel({ date, time, doctors, defaultDoctorId, onClose, onSaved }) {
  const [mode, setMode]             = useState('existing');
  const [query, setQuery]           = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [selectedPt, setSelectedPt] = useState(null);
  const [reason, setReason]         = useState('');
  // defaultDoctorId puede ser '' (vista "todos") o un UUID válido
  const validDefault = defaultDoctorId && defaultDoctorId !== 'todos' && defaultDoctorId !== ''
    ? defaultDoctorId
    : (doctors[0]?.id || '');
  const [doctorId, setDoctorId]     = useState(validDefault);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const [newPt, setNewPt] = useState({
    first_name: '', last_name: '', last_name_maternal: '',
    phone: '', birth_date: '', gender: '', privacy_accepted: false,
  });

  const [availability, setAvailability] = useState({});

  // Si doctors llegó vacío al montar, asignar el primero cuando carguen
  useEffect(() => {
    if (!doctorId && doctors.length > 0) setDoctorId(doctors[0].id);
  }, [doctors]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar disponibilidad cuando cambia el médico
  useEffect(() => {
    if (!doctorId) return;
    api.get(`/api/agenda/availability/${doctorId}`)
      .then(r => setAvailability(r.data.data || {}))
      .catch(() => setAvailability({}));
  }, [doctorId]);

  useEffect(() => {
    if (mode !== 'existing' || !query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get(`/api/patients?q=${encodeURIComponent(query)}`);
        setSearchResults((Array.isArray(r.data) ? r.data : []).slice(0, 8));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, mode]);

  const [apptDate, setApptDate] = useState(date);
  const [apptTime, setApptTime] = useState(time);

  // Validación en tiempo real contra horario del médico
  const DOW_NAMES_AP = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const DOW_ES_AP    = { sunday:'domingo', monday:'lunes', tuesday:'martes', wednesday:'miércoles', thursday:'jueves', friday:'viernes', saturday:'sábado' };

  function getScheduleWarning() {
    if (!apptDate || !apptTime || Object.keys(availability).length === 0) return null;
    const dow   = DOW_NAMES_AP[new Date(apptDate + 'T12:00:00').getDay()];
    const avail = availability[dow];
    if (!avail) return `El médico no tiene consulta los ${DOW_ES_AP[dow]}`;
    const apptMin    = timeToMinutes(apptTime);
    const availStart = timeToMinutes(avail.start_time);
    const availEnd   = timeToMinutes(avail.end_time);
    if (apptMin < availStart || apptMin + 30 > availEnd)
      return `Fuera de horario — el médico atiende de ${avail.start_time.slice(0,5)} a ${avail.end_time.slice(0,5)}`;
    return null;
  }
  const scheduleWarning = getScheduleWarning();

  const startMin  = timeToMinutes(apptTime);
  const endMin    = startMin + 30;
  const dateLabel = new Date(apptDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  async function handleSave() {
    setError('');
    let patientId = selectedPt?.id;

    if (mode === 'new') {
      if (!newPt.first_name || !newPt.last_name) { setError('Nombre y apellido son requeridos'); return; }
      if (!newPt.privacy_accepted) { setError('El paciente debe aceptar el aviso de privacidad'); return; }
      setSaving(true);
      try {
        const r = await api.post('/api/patients', newPt);
        patientId = r.data?.id || r.data?.data?.id;
        if (!patientId) throw new Error('No se pudo crear el paciente');
      } catch (e) {
        setError(e.response?.data?.error || e.message);
        setSaving(false);
        return;
      }
    } else {
      if (!selectedPt) { setError('Selecciona un paciente de la lista'); return; }
    }

    const finalDoctorId = doctorId || doctors[0]?.id;
    if (!finalDoctorId) { setError('No hay médicos disponibles'); return; }
    setSaving(true);
    try {
      await api.post('/api/agenda/appointments', {
        patient_id: patientId, doctor_id: finalDoctorId,
        appointment_date: apptDate, start_time: apptTime, reason,
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al crear la cita');
      setSaving(false);
    }
  }

  return (
    <div className="appt-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="new-appt-panel">
        <div className="new-appt-panel__header">
          <div style={{ flex: 1 }}>
            <div className="new-appt-panel__title">Nueva cita</div>
            <div className="new-appt-datetime">
              <div className="new-appt-datetime__field">
                <label className="new-appt-label">Fecha</label>
                <input type="date" className="config-input config-input--sm"
                  value={apptDate} onChange={e => setApptDate(e.target.value)} />
              </div>
              <div className="new-appt-datetime__field">
                <label className="new-appt-label">Hora inicio</label>
                <input type="time" className="config-input config-input--sm"
                  value={apptTime} onChange={e => setApptTime(e.target.value)} />
              </div>
              <div className="new-appt-datetime__field">
                <label className="new-appt-label">Hora fin</label>
                <input type="time" className="config-input config-input--sm"
                  value={`${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`}
                  disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="appt-detail-panel__close" style={{ marginLeft: '0.5rem' }}>✕</button>
        </div>

        {doctors.length > 1 && (
          <div className="new-appt-field">
            <label className="new-appt-label">Médico</label>
            <select className="config-input" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}{d.specialty ? ` · ${d.specialty}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="new-appt-mode-toggle">
          <button className={`new-appt-mode-btn ${mode === 'existing' ? 'new-appt-mode-btn--active' : ''}`}
            onClick={() => { setMode('existing'); setSelectedPt(null); setQuery(''); }}>
            🔍 Paciente existente
          </button>
          <button className={`new-appt-mode-btn ${mode === 'new' ? 'new-appt-mode-btn--active' : ''}`}
            onClick={() => { setMode('new'); setSelectedPt(null); }}>
            ★ Primera vez
          </button>
        </div>

        {mode === 'existing' && (
          <div className="new-appt-search">
            {!selectedPt ? (
              <>
                <input autoFocus className="config-input"
                  placeholder="Buscar por nombre, teléfono o CURP..."
                  value={query} onChange={e => setQuery(e.target.value)} />
                {searching && <p className="new-appt-search__hint">Buscando...</p>}
                {!searching && query && searchResults.length === 0 && (
                  <p className="new-appt-search__hint">Sin resultados</p>
                )}
                <div className="new-appt-search__list">
                  {searchResults.map(p => (
                    <div key={p.id} className="new-appt-search__row"
                      onClick={() => { setSelectedPt(p); setQuery(''); }}>
                      <div className="new-appt-search__name">
                        {p.first_name} {p.last_name} {p.last_name_maternal || ''}
                      </div>
                      <div className="new-appt-search__sub">
                        {p.phone && <span>{p.phone}</span>}
                        {p.birth_date && <span> · {new Date(p.birth_date + 'T12:00:00').getFullYear()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="new-appt-selected-pt">
                <div className="new-appt-selected-pt__name">
                  {selectedPt.first_name} {selectedPt.last_name} {selectedPt.last_name_maternal || ''}
                </div>
                {selectedPt.phone && <div className="new-appt-selected-pt__sub">{selectedPt.phone}</div>}
                <button className="new-appt-selected-pt__change" onClick={() => setSelectedPt(null)}>
                  Cambiar paciente
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'new' && (
          <div className="new-appt-new-pt">
            <div className="new-appt-row2">
              <div className="new-appt-field">
                <label className="new-appt-label">Nombre *</label>
                <input className="config-input" value={newPt.first_name}
                  onChange={e => setNewPt(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="new-appt-field">
                <label className="new-appt-label">Apellido paterno *</label>
                <input className="config-input" value={newPt.last_name}
                  onChange={e => setNewPt(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="new-appt-field">
              <label className="new-appt-label">Apellido materno</label>
              <input className="config-input" value={newPt.last_name_maternal}
                onChange={e => setNewPt(p => ({ ...p, last_name_maternal: e.target.value }))} />
            </div>
            <div className="new-appt-row2">
              <div className="new-appt-field">
                <label className="new-appt-label">Teléfono</label>
                <input className="config-input" type="tel" value={newPt.phone}
                  onChange={e => setNewPt(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="new-appt-field">
                <label className="new-appt-label">Fecha de nacimiento</label>
                <input className="config-input" type="date" value={newPt.birth_date}
                  onChange={e => setNewPt(p => ({ ...p, birth_date: e.target.value }))} />
              </div>
            </div>
            <div className="new-appt-field">
              <label className="new-appt-label">Sexo</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                {[['M','Masculino'],['F','Femenino'],['O','Otro']].map(([v, l]) => (
                  <button key={v}
                    className={`est-quick-btn ${newPt.gender === v ? 'est-quick-btn--active' : ''}`}
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setNewPt(p => ({ ...p, gender: v }))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label className="new-appt-privacy">
              <input type="checkbox" checked={newPt.privacy_accepted}
                onChange={e => setNewPt(p => ({ ...p, privacy_accepted: e.target.checked }))} />
              <span>El paciente acepta el <strong>aviso de privacidad</strong></span>
            </label>
          </div>
        )}

        <div className="new-appt-field" style={{ marginTop: '0.75rem' }}>
          <label className="new-appt-label">Motivo de consulta</label>
          <input className="config-input" placeholder="Ej. Revisión general, dolor de cabeza..."
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>

        {scheduleWarning && (
          <div className="new-appt-schedule-warn">
            ⚠️ {scheduleWarning}
          </div>
        )}

        {error && <div className="new-appt-error">{error}</div>}

        <div className="new-appt-actions">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !!scheduleWarning}>
            {saving ? 'Agendando...' : '📅 Agendar · 30 min'}
          </Button>
        </div>
      </div>
    </div>
  );
}
