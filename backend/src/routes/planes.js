const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

async function getDoctorId(supabase, userId) {
  const { data } = await supabase.from('doctors').select('id').eq('user_id', userId).single();
  return data?.id || null;
}

// GET /api/planes/mi-plan
router.get('/mi-plan', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);

    // Buscar suscripción activa o crear una en basico por defecto
    let { data: sub } = await req.supabase
      .from('doctor_subscriptions')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!sub) {
      const { data: newSub } = await req.supabase
        .from('doctor_subscriptions')
        .insert({ doctor_id: doctorId, org_id: req.user.orgId, plan: 'basico', status: 'trialing' })
        .select().single();
      sub = newSub;
    }

    // Datos de facturación de la org
    const { data: org } = await req.supabase
      .from('organizations')
      .select('rfc, razon_social, uso_cfdi, regimen_fiscal, billing_email, name, email')
      .eq('id', req.user.orgId)
      .single();

    res.json({ subscription: sub, facturacion: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/planes/historial
router.get('/historial', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);

    const { data, error } = await req.supabase
      .from('doctor_invoices')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/planes/cambiar
router.put('/cambiar', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { plan, billing_period } = req.body;

    const validPlans = ['basico', 'pro', 'clinica'];
    if (!validPlans.includes(plan)) return res.status(400).json({ error: 'Plan no válido' });

    const { data: existing } = await req.supabase
      .from('doctor_subscriptions')
      .select('id')
      .eq('doctor_id', doctorId)
      .single();

    const period = billing_period === 'annual' ? 'annual' : 'monthly';
    const periodEnd = period === 'annual'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    let data, error;
    if (existing) {
      ({ data, error } = await req.supabase
        .from('doctor_subscriptions')
        .update({ plan, billing_period: period, status: 'active', current_period_end: periodEnd, updated_at: new Date().toISOString() })
        .eq('doctor_id', doctorId).select().single());
    } else {
      ({ data, error } = await req.supabase
        .from('doctor_subscriptions')
        .insert({ doctor_id: doctorId, org_id: req.user.orgId, plan, billing_period: period, status: 'active', current_period_end: periodEnd })
        .select().single());
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, message: `Plan actualizado a ${plan}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/planes/facturacion
router.put('/facturacion', authMiddleware, async (req, res) => {
  try {
    const { rfc, razon_social, uso_cfdi, regimen_fiscal, billing_email } = req.body;

    const { data, error } = await req.supabase
      .from('organizations')
      .update({ rfc, razon_social, uso_cfdi, regimen_fiscal, billing_email, updated_at: new Date().toISOString() })
      .eq('id', req.user.orgId)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, message: 'Datos de facturación actualizados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
