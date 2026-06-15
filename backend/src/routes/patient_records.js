const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePatientAccess } = require('../utils/patientAccess');
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Todas las rutas del expediente cuelgan de /patients/:id — el médico
// solo puede acceder si el paciente está agendado con él o lo creó él.
router.use('/patients/:id', authMiddleware, requirePatientAccess);

// ══ Helpers ════════════════════════════════════════════════════
async function storageUpload(supabase, bucket, path, buffer, mimetype) {
  const { error } = await supabase.storage
    .from(bucket).upload(path, buffer, { contentType: mimetype, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

// ══ HISTORIA CLÍNICA ══════════════════════════════════════════

router.get('/patients/:id/historia', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('clinical_history').select('*')
      .eq('patient_id', req.params.id).eq('org_id', req.user.orgId).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ data: data || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/patients/:id/historia', authMiddleware, async (req, res) => {
  try {
    const payload = { ...req.body, org_id: req.user.orgId, patient_id: req.params.id, updated_at: new Date().toISOString() };
    const { data: existing } = await req.supabase
      .from('clinical_history').select('id').eq('patient_id', req.params.id).single();
    let result, error;
    if (existing) {
      ({ data: result, error } = await req.supabase
        .from('clinical_history').update(payload)
        .eq('patient_id', req.params.id).eq('org_id', req.user.orgId).select().single());
    } else {
      ({ data: result, error } = await req.supabase
        .from('clinical_history').insert(payload).select().single());
    }
    if (error) return res.status(400).json({ error: error.message });
    res.json({ data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ VACUNAS ═══════════════════════════════════════════════════

router.get('/patients/:id/vaccinations', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('vaccinations').select('*')
      .eq('patient_id', req.params.id).eq('org_id', req.user.orgId)
      .order('applied_date', { ascending: true, nullsFirst: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/patients/:id/vaccinations', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('vaccinations')
      .insert({ ...req.body, org_id: req.user.orgId, patient_id: req.params.id })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/patients/:id/vaccinations/:vacId', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('vaccinations')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.vacId).eq('org_id', req.user.orgId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/patients/:id/vaccinations/:vacId', authMiddleware, async (req, res) => {
  try {
    await req.supabase.from('vaccinations')
      .delete().eq('id', req.params.vacId).eq('org_id', req.user.orgId);
    res.json({ message: 'Vacuna eliminada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ ARCHIVOS ══════════════════════════════════════════════════

router.get('/patients/:id/files', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('patient_files').select('*')
      .eq('patient_id', req.params.id).eq('org_id', req.user.orgId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/patients/:id/files', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const path = `${req.user.orgId}/${req.params.id}/files/${Date.now()}_${req.file.originalname}`;
    const url  = await storageUpload(req.supabase, 'patient-documents', path, req.file.buffer, req.file.mimetype);
    const { data, error } = await req.supabase.from('patient_files')
      .insert({ org_id: req.user.orgId, patient_id: req.params.id,
        name: req.file.originalname, file_url: url,
        file_type: req.body.file_type || 'document',
        description: req.body.description || null,
        file_date: req.body.file_date || null,
        size_bytes: req.file.size })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/patients/:id/files/:fileId', authMiddleware, async (req, res) => {
  try {
    await req.supabase.from('patient_files')
      .delete().eq('id', req.params.fileId).eq('org_id', req.user.orgId);
    res.json({ message: 'Archivo eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ INFORMES MÉDICOS ══════════════════════════════════════════

router.get('/patients/:id/reports', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('medical_reports').select('*')
      .eq('patient_id', req.params.id).eq('org_id', req.user.orgId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/patients/:id/reports', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase.from('medical_reports')
      .insert({ ...req.body, org_id: req.user.orgId, patient_id: req.params.id })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/patients/:id/reports/:rid', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase.from('medical_reports')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.rid).eq('org_id', req.user.orgId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/patients/:id/reports/:rid', authMiddleware, async (req, res) => {
  try {
    await req.supabase.from('medical_reports')
      .delete().eq('id', req.params.rid).eq('org_id', req.user.orgId);
    res.json({ message: 'Informe eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/patients/:id/reports/:rid/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const path = `${req.user.orgId}/${req.params.id}/reports/${Date.now()}_${req.file.originalname}`;
    const url  = await storageUpload(req.supabase, 'patient-documents', path, req.file.buffer, req.file.mimetype);
    const { data, error } = await req.supabase.from('medical_reports')
      .update({ file_url: url, file_name: req.file.originalname, updated_at: new Date().toISOString() })
      .eq('id', req.params.rid).eq('org_id', req.user.orgId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ CRECIMIENTO (mediciones de notas clínicas) ════════════════

router.get('/patients/:id/growth', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('clinical_notes')
      .select('vital_signs, created_at, appointments(appointment_date)')
      .eq('patient_id', req.params.id).eq('org_id', req.user.orgId)
      .not('vital_signs', 'is', null)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const measurements = (data || [])
      .filter(n => n.vital_signs?.peso_kg || n.vital_signs?.talla_cm)
      .map(n => ({
        date: n.appointments?.appointment_date || n.created_at?.split('T')[0],
        peso_kg:  n.vital_signs?.peso_kg  ? parseFloat(n.vital_signs.peso_kg)  : null,
        talla_cm: n.vital_signs?.talla_cm ? parseFloat(n.vital_signs.talla_cm) : null,
        imc: (n.vital_signs?.peso_kg && n.vital_signs?.talla_cm)
          ? parseFloat((n.vital_signs.peso_kg / Math.pow(n.vital_signs.talla_cm / 100, 2)).toFixed(1))
          : null,
      }));
    res.json({ data: measurements });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
