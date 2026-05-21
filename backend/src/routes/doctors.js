const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// ==========================================
// POST /api/doctors — Crear doctor
// ==========================================
router.post('/doctors', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, specialty, license_number, phone, bio } = req.body;
    const org_id = req.user.org_id;

    // Validación
    if (!first_name || !last_name || !specialty || !license_number) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'first_name, last_name, specialty, and license_number are required'
      });
    }

    // Insertar doctor
    const { data, error } = await req.supabase
      .from('doctors')
      .insert([{
        org_id,
        user_id: req.user.userId,
        first_name,
        last_name,
        specialty,
        license_number,
        phone: phone || null,
        bio: bio || null,
        active: true
      }])
      .select();

    if (error) {
      return res.status(400).json({
        error: 'Failed to create doctor',
        details: error.message
      });
    }

    res.status(201).json({
      message: 'Doctor created successfully',
      doctor: data[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/doctors — Listar doctors
// ==========================================
router.get('/doctors', authMiddleware, async (req, res) => {
  try {
    const org_id = req.user.orgId;

    const { data, error } = await req.supabase
      .from('doctors')
      .select('*')
      .eq('org_id', org_id)
      .eq('active', true);

    if (error) {
      return res.status(400).json({
        error: 'Failed to fetch doctors',
        details: error.message
      });
    }

    res.json({
      count: data.length,
      doctors: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
