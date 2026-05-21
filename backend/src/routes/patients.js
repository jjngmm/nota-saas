const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// ==========================================
// POST /api/patients — Crear paciente
// ==========================================
router.post('/patients', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, email, phone, birth_date, blood_type, allergies, medical_history, notes } = req.body;
    const org_id = req.user.orgId;

    // Validación
    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'first_name, last_name, and email are required'
      });
    }

    // Insertar paciente
    const { data, error } = await req.supabase
      .from('patients')
      .insert([{
        org_id,
        first_name,
        last_name,
        email,
        phone: phone || null,
        birth_date: birth_date || null,
        blood_type: blood_type || null,
        allergies: allergies || null,
        medical_history: medical_history || null,
        notes: notes || null,
        active: true
      }])
      .select();

    if (error) {
      return res.status(400).json({
        error: 'Failed to create patient',
        details: error.message
      });
    }

    res.status(201).json({
      message: 'Patient created successfully',
      patient: data[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/patients — Listar pacientes
// ==========================================
router.get('/patients', authMiddleware, async (req, res) => {
  try {
    const org_id = req.user.orgId;

    const { data, error } = await req.supabase
      .from('patients')
      .select('*')
      .eq('org_id', org_id)
      .eq('active', true);

    if (error) {
      return res.status(400).json({
        error: 'Failed to fetch patients',
        details: error.message
      });
    }

    res.json({
      count: data.length,
      patients: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
