const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/clinical-notes?appointment_id=...
router.get('/clinical-notes', authMiddleware, async (req, res) => {
  try {
    const { appointment_id } = req.query;
    if (!appointment_id) {
      return res.status(400).json({ error: 'appointment_id requerido' });
    }

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .select('*, doctors(first_name, last_name), patients(first_name, last_name)')
      .eq('org_id', req.user.orgId)
      .eq('appointment_id', appointment_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
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

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .select('*, doctors(first_name, last_name), appointments(date, time)')
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
    const { subjective, objective, assessment, plan, raw_transcript, ai_summary } = req.body;

    const { data, error } = await req.supabase
      .from('clinical_notes')
      .update({
        subjective,
        objective,
        assessment,
        plan,
        raw_transcript,
        ai_summary,
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
router.post('/clinical-notes/:id/sign', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

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
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
