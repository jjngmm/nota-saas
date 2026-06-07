const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { hashPassword, comparePasswords } = require('../utils/auth');

// Helper: obtener doctor_id del usuario actual
async function getDoctorId(supabase, userId) {
  const { data } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', userId)
    .single();
  return data?.id || null;
}

// ── GET /api/config/doctor — Obtener toda la config del médico
router.get('/doctor', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    if (!doctorId) return res.status(404).json({ error: 'Perfil de médico no encontrado' });

    const [doctorRes, papeleriaRes, consultaRes, pagoRes] = await Promise.all([
      req.supabase.from('doctors').select('*').eq('id', doctorId).single(),
      req.supabase.from('doctor_papeleria').select('*').eq('doctor_id', doctorId).single(),
      req.supabase.from('doctor_consultation_config').select('*').eq('doctor_id', doctorId).single(),
      req.supabase.from('doctor_payment_config').select('*').eq('doctor_id', doctorId).single(),
    ]);

    res.json({
      doctor: doctorRes.data,
      papeleria: papeleriaRes.data || null,
      consulta_config: consultaRes.data || null,
      payment_config: pagoRes.data || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/config/perfil — Actualizar perfil del médico
router.put('/perfil', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    if (!doctorId) return res.status(404).json({ error: 'Perfil de médico no encontrado' });

    const {
      first_name, last_name, last_name_maternal, specialty, phone,
      license_number, bio, profile_image_url, signature_url,
      address, colonia, ciudad, estado, codigo_postal,
      google_calendar_sync, google_sheets_sync,
    } = req.body;

    const { data, error } = await req.supabase
      .from('doctors')
      .update({
        first_name, last_name, last_name_maternal, specialty, phone,
        license_number, bio, profile_image_url, signature_url,
        address, colonia, ciudad, estado, codigo_postal,
        google_calendar_sync, google_sheets_sync,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doctorId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/config/password — Cambiar contraseña
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const { data: user } = await req.supabase
      .from('auth_users')
      .select('password_hash')
      .eq('id', req.user.userId)
      .single();

    const valid = await comparePasswords(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    const hash = await hashPassword(new_password);
    await req.supabase
      .from('auth_users')
      .update({ password_hash: hash })
      .eq('id', req.user.userId);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/config/papeleria — Guardar config de papelería
router.put('/papeleria', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    if (!doctorId) return res.status(404).json({ error: 'Perfil de médico no encontrado' });

    const { logo_url, header_text, footer_text, color_primary, show_license, show_address } = req.body;

    const { data: existing } = await req.supabase
      .from('doctor_papeleria')
      .select('id')
      .eq('doctor_id', doctorId)
      .single();

    let data, error;
    if (existing) {
      ({ data, error } = await req.supabase
        .from('doctor_papeleria')
        .update({ logo_url, header_text, footer_text, color_primary, show_license, show_address, updated_at: new Date().toISOString() })
        .eq('doctor_id', doctorId)
        .select().single());
    } else {
      ({ data, error } = await req.supabase
        .from('doctor_papeleria')
        .insert({ doctor_id: doctorId, org_id: req.user.orgId, logo_url, header_text, footer_text, color_primary, show_license, show_address })
        .select().single());
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/config/templates — Plantillas para pacientes
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    if (!doctorId) return res.status(404).json({ error: 'Perfil de médico no encontrado' });

    const { data, error } = await req.supabase
      .from('doctor_patient_templates')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/config/templates
router.post('/templates', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    if (!doctorId) return res.status(404).json({ error: 'Perfil de médico no encontrado' });

    const { type, title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es requerido' });

    const { data, error } = await req.supabase
      .from('doctor_patient_templates')
      .insert({ doctor_id: doctorId, org_id: req.user.orgId, type, title, content })
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/config/templates/:id
router.put('/templates/:id', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    const { type, title, content } = req.body;

    const { data, error } = await req.supabase
      .from('doctor_patient_templates')
      .update({ type, title, content, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('doctor_id', doctorId)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/config/templates/:id
router.delete('/templates/:id', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    await req.supabase.from('doctor_patient_templates').delete().eq('id', req.params.id).eq('doctor_id', doctorId);
    res.json({ message: 'Plantilla eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/config/consulta — Config de personalización de consulta
router.put('/consulta', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    if (!doctorId) return res.status(404).json({ error: 'Perfil de médico no encontrado' });

    const { config, historia_clinica_config, parametros_config } = req.body;

    const { data: existing } = await req.supabase
      .from('doctor_consultation_config')
      .select('id')
      .eq('doctor_id', doctorId)
      .single();

    let data, error;
    if (existing) {
      ({ data, error } = await req.supabase
        .from('doctor_consultation_config')
        .update({ config, historia_clinica_config, parametros_config, updated_at: new Date().toISOString() })
        .eq('doctor_id', doctorId)
        .select().single());
    } else {
      ({ data, error } = await req.supabase
        .from('doctor_consultation_config')
        .insert({ doctor_id: doctorId, org_id: req.user.orgId, config, historia_clinica_config, parametros_config })
        .select().single());
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/config/pagos — Config de cobros online
router.put('/pagos', authMiddleware, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req.supabase, req.user.userId);
    if (!doctorId) return res.status(404).json({ error: 'Perfil de médico no encontrado' });

    const {
      mercadopago_enabled, mercadopago_key,
      paypal_enabled, paypal_email,
      transfer_enabled, transfer_bank, transfer_clabe, transfer_titular,
    } = req.body;

    const { data: existing } = await req.supabase
      .from('doctor_payment_config')
      .select('id')
      .eq('doctor_id', doctorId)
      .single();

    const payload = {
      mercadopago_enabled, mercadopago_key,
      paypal_enabled, paypal_email,
      transfer_enabled, transfer_bank, transfer_clabe, transfer_titular,
    };

    let data, error;
    if (existing) {
      ({ data, error } = await req.supabase
        .from('doctor_payment_config')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('doctor_id', doctorId)
        .select().single());
    } else {
      ({ data, error } = await req.supabase
        .from('doctor_payment_config')
        .insert({ doctor_id: doctorId, org_id: req.user.orgId, ...payload })
        .select().single());
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
