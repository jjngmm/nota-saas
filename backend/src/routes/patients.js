const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { accessiblePatientIds, canAccessPatient } = require('../utils/patientAccess');

function calcAge(birthDate) {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function formatPatient(p) {
  const age = calcAge(p.birth_date);
  return {
    ...p,
    full_name: [p.first_name, p.last_name, p.last_name_maternal].filter(Boolean).join(' '),
    age,
    is_minor: age !== null && age < 18,
  };
}

// ── GET /api/patients — Listar con búsqueda avanzada
router.get('/patients', authMiddleware, async (req, res) => {
  try {
    const { q, gender, age_min, age_max, phone } = req.query;
    const org_id = req.user.orgId;

    let query = req.supabase
      .from('patients')
      .select('*')
      .eq('org_id', org_id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    // Médicos solo ven sus pacientes (agendados con ellos o creados por ellos)
    const allowedIds = await accessiblePatientIds(req.supabase, req.user);
    if (allowedIds !== null) query = query.in('id', allowedIds.length ? allowedIds : ['00000000-0000-0000-0000-000000000000']);

    if (gender) query = query.eq('gender', gender);
    if (phone)  query = query.ilike('phone', `%${phone}%`);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    let patients = (data || []).map(formatPatient);

    // Filtro por nombre/texto
    if (q) {
      const term = q.toLowerCase();
      patients = patients.filter(p =>
        p.full_name?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.phone?.includes(term) ||
        p.curp?.toLowerCase().includes(term) ||
        p.ocupacion?.toLowerCase().includes(term)
      );
    }

    // Filtro por edad
    if (age_min) patients = patients.filter(p => p.age !== null && p.age >= parseInt(age_min));
    if (age_max) patients = patients.filter(p => p.age !== null && p.age <= parseInt(age_max));

    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/patients/search — Búsqueda avanzada incluyendo diagnósticos
router.get('/patients/search', authMiddleware, async (req, res) => {
  try {
    const { q, gender, age_min, age_max, diagnostico } = req.query;
    const org_id = req.user.orgId;

    let baseQuery = req.supabase
      .from('patients')
      .select('*')
      .eq('org_id', org_id)
      .eq('active', true);

    const allowedIds = await accessiblePatientIds(req.supabase, req.user);
    if (allowedIds !== null) baseQuery = baseQuery.in('id', allowedIds.length ? allowedIds : ['00000000-0000-0000-0000-000000000000']);

    const { data, error } = await baseQuery;

    if (error) return res.status(400).json({ error: error.message });

    let patients = (data || []).map(formatPatient);

    if (q) {
      const term = q.toLowerCase();
      patients = patients.filter(p =>
        p.full_name?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.phone?.includes(term) ||
        p.curp?.toLowerCase().includes(term)
      );
    }
    if (gender) patients = patients.filter(p => p.gender === gender);
    if (age_min) patients = patients.filter(p => p.age !== null && p.age >= parseInt(age_min));
    if (age_max) patients = patients.filter(p => p.age !== null && p.age <= parseInt(age_max));

    // Búsqueda por diagnóstico — join con clinical_notes
    if (diagnostico) {
      const { data: notes } = await req.supabase
        .from('clinical_notes')
        .select('patient_id, assessment')
        .eq('org_id', org_id)
        .ilike('assessment', `%${diagnostico}%`);

      const patientIdsWithDx = new Set((notes || []).map(n => n.patient_id));
      patients = patients.filter(p => patientIdsWithDx.has(p.id));
    }

    res.json({ data: patients, total: patients.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/patients/:id
router.get('/patients/:id', authMiddleware, async (req, res) => {
  try {
    const allowed = await canAccessPatient(req.supabase, req.user, req.params.id);
    if (!allowed) return res.status(403).json({ error: 'No tienes acceso al expediente de este paciente' });

    const { data, error } = await req.supabase
      .from('patients')
      .select('*')
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json(formatPatient(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/patients — Crear paciente
router.post('/patients', authMiddleware, async (req, res) => {
  try {
    const {
      first_name, last_name, last_name_maternal,
      birth_date, gender, phone, email,
      curp, blood_type, address, colonia, ciudad, estado, codigo_postal,
      estado_civil, ocupacion, allergies, notes,
      privacy_accepted,
      // Acompañante
      companion_first_name, companion_last_name, companion_last_name_maternal,
      companion_relationship, companion_email, companion_phone, companion_dob,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'Nombre y apellido paterno son requeridos' });
    }
    if (!privacy_accepted) {
      return res.status(400).json({ error: 'Debe aceptarse el aviso de privacidad' });
    }

    const age = calcAge(birth_date);
    const is_minor = age !== null && age < 18;

    const { data, error } = await req.supabase
      .from('patients')
      .insert([{
        org_id: req.user.orgId,
        created_by: req.user.userId,
        first_name, last_name, last_name_maternal: last_name_maternal || null,
        birth_date: birth_date || null,
        gender: gender || null,
        phone: is_minor ? null : (phone || null),
        email: is_minor ? null : (email || null),
        curp: curp || null,
        blood_type: blood_type || null,
        address: address || null,
        colonia: colonia || null,
        ciudad: ciudad || null,
        estado: estado || null,
        codigo_postal: codigo_postal || null,
        estado_civil: estado_civil || null,
        ocupacion: ocupacion || null,
        allergies: allergies || null,
        notes: notes || null,
        privacy_accepted: true,
        privacy_accepted_at: new Date().toISOString(),
        is_minor,
        companion_first_name: is_minor ? (companion_first_name || null) : null,
        companion_last_name: is_minor ? (companion_last_name || null) : null,
        companion_last_name_maternal: is_minor ? (companion_last_name_maternal || null) : null,
        companion_relationship: is_minor ? (companion_relationship || null) : null,
        companion_email: is_minor ? (companion_email || null) : null,
        companion_phone: is_minor ? (companion_phone || null) : null,
        companion_dob: is_minor ? (companion_dob || null) : null,
        active: true,
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(formatPatient(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/patients/:id — Actualizar
router.patch('/patients/:id', authMiddleware, async (req, res) => {
  try {
    const {
      first_name, last_name, last_name_maternal,
      birth_date, gender, phone, email,
      curp, blood_type, address, colonia, ciudad, estado, codigo_postal,
      estado_civil, ocupacion, allergies, notes,
      companion_first_name, companion_last_name, companion_last_name_maternal,
      companion_relationship, companion_email, companion_phone, companion_dob,
    } = req.body;

    const age = calcAge(birth_date);
    const is_minor = age !== null && age < 18;

    const { data, error } = await req.supabase
      .from('patients')
      .update({
        first_name, last_name, last_name_maternal: last_name_maternal || null,
        birth_date: birth_date || null, gender: gender || null,
        phone: is_minor ? null : (phone || null),
        email: is_minor ? null : (email || null),
        curp: curp || null, blood_type: blood_type || null,
        address: address || null, colonia: colonia || null,
        ciudad: ciudad || null, estado: estado || null,
        codigo_postal: codigo_postal || null,
        estado_civil: estado_civil || null, ocupacion: ocupacion || null,
        allergies: allergies || null, notes: notes || null,
        is_minor,
        companion_first_name: is_minor ? (companion_first_name || null) : null,
        companion_last_name: is_minor ? (companion_last_name || null) : null,
        companion_last_name_maternal: is_minor ? (companion_last_name_maternal || null) : null,
        companion_relationship: is_minor ? (companion_relationship || null) : null,
        companion_email: is_minor ? (companion_email || null) : null,
        companion_phone: is_minor ? (companion_phone || null) : null,
        companion_dob: is_minor ? (companion_dob || null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(formatPatient(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/patients/:id/consent — Firmar consentimiento informado
router.patch('/patients/:id/consent', authMiddleware, async (req, res) => {
  try {
    const { witness } = req.body;
    const { data, error } = await req.supabase
      .from('patients')
      .update({
        consent_signed: true,
        consent_signed_at: new Date().toISOString(),
        consent_witness: witness || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(formatPatient(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/patients/:id/id-document — Subir identificación oficial
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.post('/patients/:id/id-document', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const { document_type } = req.body;
    const ext = req.file.originalname.split('.').pop();
    const path = `${req.user.orgId}/${req.params.id}/id_${Date.now()}.${ext}`;

    const { error: upErr } = await req.supabase.storage
      .from('patient-documents')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

    if (upErr) return res.status(500).json({ error: upErr.message });

    const { data: { publicUrl } } = req.supabase.storage
      .from('patient-documents')
      .getPublicUrl(path);

    const { data, error } = await req.supabase
      .from('patients')
      .update({
        id_document_type: document_type || null,
        id_document_url: publicUrl,
        id_document_name: req.file.originalname,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(formatPatient(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/patients/:id/billing — Guardar datos de facturación
router.patch('/patients/:id/billing', authMiddleware, async (req, res) => {
  try {
    const { requires_invoice, rfc, razon_social, uso_cfdi, regimen_fiscal, billing_email } = req.body;
    const { data, error } = await req.supabase
      .from('patients')
      .update({
        requires_invoice: !!requires_invoice,
        rfc: rfc || null,
        razon_social: razon_social || null,
        uso_cfdi: uso_cfdi || null,
        regimen_fiscal: regimen_fiscal || null,
        billing_email: billing_email || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(formatPatient(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/patients/:id — Soft delete
router.delete('/patients/:id', authMiddleware, async (req, res) => {
  try {
    await req.supabase
      .from('patients')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId);

    res.json({ message: 'Paciente eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
