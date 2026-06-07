const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

async function getDoctorId(supabase, userId) {
  const { data } = await supabase.from('doctors').select('id').eq('user_id', userId).single();
  return data?.id || null;
}

// ── GET /api/estadisticas/resumen — Dashboard general
router.get('/resumen', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { desde, hasta } = req.query;
    const orgId = req.user.orgId;

    const dateFilter = (q) => {
      if (desde) q = q.gte('created_at', desde);
      if (hasta) q = q.lte('created_at', hasta + 'T23:59:59');
      return q;
    };

    const [apptRes, movRes, suiveRes, patientsRes] = await Promise.all([
      dateFilter(req.supabase.from('appointments').select('id, status, appointment_date').eq('org_id', orgId)),
      dateFilter(req.supabase.from('movimientos_financieros').select('tipo, monto, fecha, categoria').eq('doctor_id', doctorId)),
      req.supabase.from('suive_reportes').select('id, status').eq('doctor_id', doctorId),
      req.supabase.from('patients').select('id, created_at').eq('org_id', orgId),
    ]);

    const appts = apptRes.data || [];
    const movs  = movRes.data || [];
    const suive = suiveRes.data || [];

    const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0);

    res.json({
      consultas: {
        total: appts.length,
        completadas: appts.filter(a => a.status === 'completed').length,
        canceladas:  appts.filter(a => a.status === 'cancelled').length,
        programadas: appts.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length,
      },
      financiero: {
        ingresos,
        egresos,
        balance: ingresos - egresos,
        total_movimientos: movs.length,
      },
      suive: {
        total: suive.length,
        pendientes: suive.filter(s => s.status === 'pendiente').length,
        reportados: suive.filter(s => s.status === 'reportado').length,
      },
      pacientes: {
        total: (patientsRes.data || []).length,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/estadisticas/consultas — Serie temporal de consultas
router.get('/consultas', authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { desde, hasta, agrupacion = 'mes' } = req.query;

    let q = req.supabase.from('appointments')
      .select('id, status, appointment_date, doctors(first_name, last_name, specialty)')
      .eq('org_id', orgId)
      .order('appointment_date', { ascending: true });

    if (desde) q = q.gte('appointment_date', desde);
    if (hasta) q = q.lte('appointment_date', hasta);

    const { data: appts, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // Agrupar por mes o semana
    const grouped = {};
    (appts || []).forEach(a => {
      const d = new Date(a.appointment_date);
      let key;
      if (agrupacion === 'semana') {
        const week = getWeekNumber(d);
        key = `${d.getFullYear()}-S${String(week).padStart(2,'0')}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      }
      if (!grouped[key]) grouped[key] = { periodo: key, total: 0, completadas: 0, canceladas: 0, no_show: 0 };
      grouped[key].total++;
      if (a.status === 'completed') grouped[key].completadas++;
      if (a.status === 'cancelled') grouped[key].canceladas++;
      if (a.status === 'no_show')   grouped[key].no_show++;
    });

    // Por especialidad
    const porEsp = {};
    (appts || []).forEach(a => {
      const esp = a.doctors?.specialty || 'Sin especialidad';
      porEsp[esp] = (porEsp[esp] || 0) + 1;
    });

    res.json({
      serie: Object.values(grouped),
      por_especialidad: Object.entries(porEsp).map(([k,v]) => ({ especialidad: k, total: v })),
      total: (appts || []).length,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/estadisticas/financiero — Ingresos y egresos
router.get('/financiero', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { desde, hasta } = req.query;

    let q = req.supabase.from('movimientos_financieros')
      .select('*').eq('doctor_id', doctorId).order('fecha', { ascending: true });

    if (desde) q = q.gte('fecha', desde);
    if (hasta) q = q.lte('fecha', hasta);

    const { data: movs, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    const list = movs || [];
    const ingresos = list.filter(m => m.tipo === 'ingreso');
    const egresos  = list.filter(m => m.tipo === 'egreso');

    // Serie mensual
    const serieMes = {};
    list.forEach(m => {
      const d = new Date(m.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!serieMes[key]) serieMes[key] = { periodo: key, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') serieMes[key].ingresos += parseFloat(m.monto);
      else serieMes[key].egresos += parseFloat(m.monto);
    });

    // Por categoría
    const porCat = {};
    list.forEach(m => {
      const cat = m.categoria || 'Sin categoría';
      if (!porCat[cat]) porCat[cat] = { categoria: cat, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') porCat[cat].ingresos += parseFloat(m.monto);
      else porCat[cat].egresos += parseFloat(m.monto);
    });

    res.json({
      movimientos: list,
      serie: Object.values(serieMes),
      por_categoria: Object.values(porCat),
      resumen: {
        total_ingresos: ingresos.reduce((s,m) => s + parseFloat(m.monto), 0),
        total_egresos:  egresos.reduce((s,m)  => s + parseFloat(m.monto), 0),
        por_metodo: list.reduce((acc, m) => {
          const met = m.metodo_pago || 'otro';
          if (!acc[met]) acc[met] = 0;
          acc[met] += parseFloat(m.monto);
          return acc;
        }, {}),
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/estadisticas/movimiento — Registrar ingreso/egreso
router.post('/movimiento', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { tipo, categoria, concepto, monto, fecha, metodo_pago, paciente_id, appointment_id, notas } = req.body;

    if (!tipo || !concepto || !monto) return res.status(400).json({ error: 'tipo, concepto y monto son requeridos' });

    const { data, error } = await req.supabase.from('movimientos_financieros')
      .insert({ doctor_id: doctorId, org_id: req.user.orgId, tipo, categoria, concepto, monto, fecha: fecha || new Date().toISOString().split('T')[0], metodo_pago, paciente_id: paciente_id || null, appointment_id: appointment_id || null, notas })
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/estadisticas/movimiento/:id
router.delete('/movimiento/:id', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    await req.supabase.from('movimientos_financieros').delete().eq('id', req.params.id).eq('doctor_id', doctorId);
    res.json({ message: 'Movimiento eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/estadisticas/suive
router.get('/suive', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { desde, hasta, status } = req.query;

    let q = req.supabase.from('suive_reportes')
      .select('*, patients(first_name, last_name)')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (desde)  q = q.gte('fecha_diagnostico', desde);
    if (hasta)  q = q.lte('fecha_diagnostico', hasta);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // Agrupar por enfermedad
    const porEnf = {};
    (data || []).forEach(r => {
      porEnf[r.enfermedad] = (porEnf[r.enfermedad] || 0) + 1;
    });

    res.json({
      reportes: data || [],
      por_enfermedad: Object.entries(porEnf).map(([k,v]) => ({ enfermedad: k, total: v })).sort((a,b) => b.total - a.total),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/estadisticas/suive
router.post('/suive', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { enfermedad, clave_cie10, fecha_inicio_sintomas, fecha_diagnostico, edad_paciente, sexo, municipio, estado, paciente_id, appointment_id, notas } = req.body;

    if (!enfermedad) return res.status(400).json({ error: 'La enfermedad es requerida' });

    const hoy = new Date();
    const semanaEpi = getWeekNumber(hoy);

    const { data, error } = await req.supabase.from('suive_reportes')
      .insert({ doctor_id: doctorId, org_id: req.user.orgId, enfermedad, clave_cie10, fecha_inicio_sintomas, fecha_diagnostico: fecha_diagnostico || hoy.toISOString().split('T')[0], edad_paciente, sexo, municipio, estado, semana_epidemiologica: semanaEpi, paciente_id: paciente_id || null, appointment_id: appointment_id || null, notas })
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/estadisticas/suive/:id/reportar
router.put('/suive/:id/reportar', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { data, error } = await req.supabase.from('suive_reportes')
      .update({ status: 'reportado', reportado_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('doctor_id', doctorId).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

module.exports = router;
