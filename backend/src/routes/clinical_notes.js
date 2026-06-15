const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { canAccessPatient } = require('../utils/patientAccess');

// GET /api/clinical-notes?appointment_id=...
router.get('/clinical-notes', authMiddleware, async (req, res) => {
  try {
    const { appointment_id } = req.query;
    if (!appointment_id) {
      return res.status(400).json({ error: 'appointment_id requerido' });
    }

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .select('*, doctors(first_name, last_name, last_name_maternal, specialty, license_number, signature_url, user_id), patients(first_name, last_name)')
      .eq('org_id', req.user.orgId)
      .eq('appointment_id', appointment_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    // Médico solo puede ver notas de sus pacientes
    if (data && !(await canAccessPatient(req.supabase, req.user, data.patient_id))) {
      return res.status(403).json({ error: 'No tienes acceso a las notas de este paciente' });
    }

    res.json({ data: data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clinical-notes/patient/:patient_id
router.get('/clinical-notes/patient/:patient_id', authMiddleware, async (req, res) => {
  try {
    const { patient_id } = req.params;

    if (!(await canAccessPatient(req.supabase, req.user, patient_id))) {
      return res.status(403).json({ error: 'No tienes acceso a las notas de este paciente' });
    }

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .select('*, doctors(first_name, last_name, last_name_maternal, specialty, license_number, signature_url, user_id), appointments(date, time)')
      .eq('org_id', req.user.orgId)
      .eq('patient_id', patient_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clinical-notes
router.post('/clinical-notes', authMiddleware, async (req, res) => {
  try {
    const { appointment_id, patient_id, doctor_id, subjective, objective, assessment, plan } = req.body;

    if (!appointment_id || !patient_id || !doctor_id) {
      return res.status(400).json({ error: 'appointment_id, patient_id y doctor_id son requeridos' });
    }

    if (!(await canAccessPatient(req.supabase, req.user, patient_id))) {
      return res.status(403).json({ error: 'No tienes acceso al expediente de este paciente' });
    }

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .insert({
        org_id: req.user.orgId,
        appointment_id,
        patient_id,
        doctor_id,
        subjective,
        objective,
        assessment,
        plan,
        status: 'draft',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clinical-notes/:id
router.put('/clinical-notes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subjective, objective, assessment, plan,
      raw_transcript, ai_summary,
      vital_signs, diagnosis, diagnosis_cie10, prescriptions,
    } = req.body;

    // Verificar que la nota sea de un paciente al que el médico tiene acceso
    const { data: existing } = await req.supabase
      .from('clinical_notes').select('patient_id, status')
      .eq('id', id).eq('org_id', req.user.orgId).single();
    if (!existing) return res.status(404).json({ error: 'Nota no encontrada' });
    if (!(await canAccessPatient(req.supabase, req.user, existing.patient_id))) {
      return res.status(403).json({ error: 'No tienes acceso a esta nota' });
    }
    if (existing.status === 'signed') {
      return res.status(400).json({ error: 'La nota ya está firmada y no puede modificarse' });
    }

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .update({
        subjective, objective, assessment, plan,
        raw_transcript, ai_summary,
        vital_signs, diagnosis, diagnosis_cie10, prescriptions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', req.user.orgId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clinical-notes/:id/sign
// Solo el médico tratante (doctor_id de la nota) puede firmarla.
router.post('/clinical-notes/:id/sign', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener la nota
    const { data: note, error: noteErr } = await req.supabase
      .from('clinical_notes')
      .select('id, doctor_id, status')
      .eq('id', id)
      .eq('org_id', req.user.orgId)
      .single();

    if (noteErr || !note) return res.status(404).json({ error: 'Nota no encontrada' });
    if (note.status === 'signed') return res.status(400).json({ error: 'La nota ya está firmada' });

    // 2. Obtener el perfil de médico del usuario que firma
    const { data: signerDoctor } = await req.supabase
      .from('doctors')
      .select('id, first_name, last_name')
      .eq('user_id', req.user.userId)
      .eq('org_id', req.user.orgId)
      .single();

    if (!signerDoctor) {
      return res.status(403).json({ error: 'Solo un médico con perfil puede firmar notas clínicas' });
    }

    // 3. El firmante debe ser el médico tratante de la nota
    if (signerDoctor.id !== note.doctor_id) {
      return res.status(403).json({ error: 'Solo el médico tratante puede firmar esta nota' });
    }

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by: req.user.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', req.user.orgId)
      .select('*, doctors(first_name, last_name, last_name_maternal, specialty, license_number, signature_url, user_id), patients(first_name, last_name)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
