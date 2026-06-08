const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

async function getDoctorId(supabase, userId) {
  const { data } = await supabase.from('doctors').select('id').eq('user_id', userId).single();
  return data?.id || null;
}

// Calcula minutos desde medianoche para un string "HH:MM"
function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Computa si es primera visita (no tiene citas completadas previas con este doctor)
async function enrichAppointments(supabase, appointments, orgId) {
  if (!appointments.length) return [];

  // Para cada paciente, contar citas completadas anteriores
  const patientIds = [...new Set(appointments.map(a => a.patient_id).filter(Boolean))];

  let prevCounts = {};
  if (patientIds.length > 0) {
    const { data: prevAppts } = await supabase
      .from('appointments')
      .select('patient_id, id')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .in('patient_id', patientIds);

    (prevAppts || []).forEach(a => {
      prevCounts[a.patient_id] = (prevCounts[a.patient_id] || 0) + 1;
    });
  }

  return appointments.map(a => {
    const prevCount = prevCounts[a.patient_id] || 0;
    const isFirstVisit = prevCount === 0;
    const waitMinutes = a.arrived_at
      ? Math.floor((Date.now() - new Date(a.arrived_at).getTime()) / 60000)
      : null;

    return {
      ...a,
      is_first_visit: isFirstVisit,
      wait_minutes: waitMinutes,
      start_minutes: timeToMinutes(a.start_time),
      visit_type: isFirstVisit ? 'primera_vez' : 'recurrente',
      display_status: a.arrived_at && (a.status === 'scheduled' || a.status === 'confirmed')
        ? 'waiting'
        : a.status,
    };
  });
}

// ── GET /api/agenda?date=YYYY-MM-DD&view=day|week|month&doctor_id=...
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0], view = 'day', doctor_id } = req.query;
    const orgId = req.user.orgId;

    // Calcular rango de fechas según la vista
    const d = new Date(date + 'T12:00:00');
    let dateFrom, dateTo;

    if (view === 'day') {
      dateFrom = dateTo = date;
    } else if (view === 'week') {
      const dow = d.getDay(); // 0=dom, 1=lun...
      const monday = new Date(d); monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      dateFrom = monday.toISOString().split('T')[0];
      dateTo   = sunday.toISOString().split('T')[0];
    } else { // month
      dateFrom = `${date.substring(0, 7)}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      dateTo = lastDay.toISOString().split('T')[0];
    }

    let query = req.supabase
      .from('appointments')
      .select(`
        *,
        patients(id, first_name, last_name, last_name_maternal, phone, birth_date, gender),
        doctors(id, first_name, last_name, specialty)
      `)
      .eq('org_id', orgId)
      .gte('appointment_date', dateFrom)
      .lte('appointment_date', dateTo)
      .order('appointment_date')
      .order('start_time');

    if (doctor_id) query = query.eq('doctor_id', doctor_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const enriched = await enrichAppointments(req.supabase, data || [], orgId);

    // KPIs del día (siempre para la fecha seleccionada)
    const todayAppts = view === 'day'
      ? enriched
      : enriched.filter(a => a.appointment_date === date);

    const kpis = {
      total:       todayAppts.length,
      agendadas:   todayAppts.filter(a => ['scheduled', 'confirmed'].includes(a.status) && !a.arrived_at).length,
      en_sala:     todayAppts.filter(a => a.display_status === 'waiting').length,
      en_consulta: todayAppts.filter(a => a.display_status === 'in_progress').length,
      completadas: todayAppts.filter(a => a.status === 'completed').length,
      canceladas:  todayAppts.filter(a => a.status === 'cancelled').length,
      no_show:     todayAppts.filter(a => a.status === 'no_show').length,
      primera_vez: todayAppts.filter(a => a.is_first_visit).length,
      recurrentes: todayAppts.filter(a => !a.is_first_visit).length,
    };

    // Bloques del período
    let blocksQuery = req.supabase
      .from('agenda_blocks')
      .select('*')
      .eq('org_id', orgId)
      .gte('date', dateFrom)
      .lte('date', dateTo);

    if (doctor_id) blocksQuery = blocksQuery.eq('doctor_id', doctor_id);
    const { data: blocks } = await blocksQuery;

    res.json({ appointments: enriched, blocks: blocks || [], kpis, dateFrom, dateTo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const DOW_ES = { sunday:'domingo', monday:'lunes', tuesday:'martes', wednesday:'miércoles', thursday:'jueves', friday:'viernes', saturday:'sábado' };
const DOW_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// ── GET /api/agenda/availability/:doctor_id — Horario del médico
router.get('/availability/:doctor_id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('doctor_availability')
      .select('day_of_week, start_time, end_time')
      .eq('doctor_id', req.params.doctor_id);
    if (error) return res.status(500).json({ error: error.message });
    // Devuelve un mapa día → { start_time, end_time }
    const map = {};
    (data || []).forEach(r => { map[r.day_of_week] = { start_time: r.start_time, end_time: r.end_time }; });
    res.json({ data: map });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/agenda/appointments — Crear cita desde la agenda
router.post('/appointments', authMiddleware, async (req, res) => {
  try {
    const { patient_id, doctor_id, appointment_date, start_time, reason, notes } = req.body;
    if (!patient_id || !appointment_date || !start_time) {
      return res.status(400).json({ error: 'patient_id, appointment_date y start_time son requeridos' });
    }

    // Calcular end_time (+30 min)
    const [h, m] = start_time.split(':').map(Number);
    const endMin = h * 60 + m + 30;
    const end_time = `${String(Math.floor(endMin / 60)).padStart(2,'0')}:${String(endMin % 60).padStart(2,'0')}`;
    const scheduled_at = `${appointment_date}T${start_time}:00`;

    // Resolver doctor_id
    let resolvedDoctorId = doctor_id;
    if (!resolvedDoctorId) {
      const { data: doc } = await req.supabase
        .from('doctors').select('id').eq('user_id', req.user.userId).single();
      if (!doc) return res.status(400).json({ error: 'doctor_id requerido' });
      resolvedDoctorId = doc.id;
    }

    // ── Validar contra horario del médico ──
    const dow = DOW_NAMES[new Date(appointment_date + 'T12:00:00').getDay()];
    const { data: avail } = await req.supabase
      .from('doctor_availability')
      .select('start_time, end_time')
      .eq('doctor_id', resolvedDoctorId)
      .eq('day_of_week', dow)
      .single();

    if (!avail) {
      return res.status(409).json({
        error: `El médico no tiene consulta los ${DOW_ES[dow]}`,
        code: 'outside_schedule',
      });
    }

    const apptStartMin  = timeToMinutes(start_time);
    const availStartMin = timeToMinutes(avail.start_time);
    const availEndMin   = timeToMinutes(avail.end_time);

    if (apptStartMin < availStartMin || apptStartMin + 30 > availEndMin) {
      return res.status(409).json({
        error: `Fuera del horario del médico. Atiende de ${avail.start_time.slice(0,5)} a ${avail.end_time.slice(0,5)}`,
        code: 'outside_schedule',
        available: { start_time: avail.start_time, end_time: avail.end_time },
      });
    }

    const { data, error } = await req.supabase
      .from('appointments')
      .insert([{
        org_id: req.user.orgId,
        doctor_id: resolvedDoctorId,
        patient_id,
        appointment_date,
        start_time,
        end_time,
        scheduled_at,
        duration_minutes: 30,
        reason: reason || null,
        notes: notes || null,
        status: 'scheduled',
        created_by: req.user.userId,
      }])
      .select(`*, patients(id, first_name, last_name, phone), doctors(id, first_name, last_name, specialty)`)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/agenda/patient/:patient_id/upcoming — próximas citas del paciente
router.get('/patient/:patient_id/upcoming', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await req.supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time, end_time, reason, status,
        doctors(id, first_name, last_name, specialty)
      `)
      .eq('org_id', req.user.orgId)
      .eq('patient_id', req.params.patient_id)
      .gte('appointment_date', today)
      .not('status', 'in', '("cancelled","no_show")')
      .order('appointment_date')
      .order('start_time')
      .limit(5);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/agenda/doctors — Médicos disponibles hoy (para selector)
router.get('/doctors', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('doctors')
      .select('id, first_name, last_name, specialty')
      .eq('org_id', req.user.orgId)
      .eq('active', true);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/agenda/arrive/:id — Marcar llegada del paciente
router.post('/arrive/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('appointments')
      .update({ arrived_at: new Date().toISOString(), status: 'confirmed' })
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/agenda/status/:id — Cambiar status (en consulta, completada, etc.)
router.post('/status/:id', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });

    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'in_progress') updates.consulted_at = new Date().toISOString();
    if (status === 'completed' && !req.body.consulted_at) updates.consulted_at = updates.consulted_at || new Date().toISOString();

    const { data, error } = await req.supabase
      .from('appointments')
      .update(updates)
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/agenda/blocks
router.get('/blocks', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { data } = await req.supabase
      .from('agenda_blocks')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('date').order('start_time');
    res.json({ data: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/agenda/blocks
router.post('/blocks', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { title, date, start_time, end_time, tipo, color } = req.body;
    if (!title || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'title, date, start_time y end_time son requeridos' });
    }
    const { data, error } = await req.supabase
      .from('agenda_blocks')
      .insert({ doctor_id: doctorId, org_id: req.user.orgId, title, date, start_time, end_time, tipo: tipo || 'bloqueo', color: color || '#6B7C80' })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/agenda/blocks/:id
router.delete('/blocks/:id', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    await req.supabase.from('agenda_blocks').delete().eq('id', req.params.id).eq('doctor_id', doctorId);
    res.json({ message: 'Bloque eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
