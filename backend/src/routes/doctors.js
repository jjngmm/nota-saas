const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

router.post('/doctors', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { first_name, last_name, specialty, license_number, phone, bio } = req.body;
    const org_id = req.user.orgId;
    const user_id = req.user.userId;

    if (!first_name || !last_name || !specialty || !license_number) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const doctorData = {
      org_id: org_id,
      user_id: user_id,
      first_name: first_name,
      last_name: last_name,
      specialty: specialty,
      license_number: license_number,
      phone: phone || null,
      bio: bio || null,
      active: true
    };

    const { data, error } = await req.supabase
      .from('doctors')
      .insert([doctorData])
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

// GET para pacientes - devuelve doctors de la clínica
router.get('/doctors', async (req, res) => {
  try {
    const orgId = req.headers['x-org-id'] || req.query.orgId;

    if (!orgId) {
      return res.status(400).json({
        error: 'Missing organization ID',
        details: 'Include X-Org-Id header or ?orgId query parameter'
      });
    }

    const { data, error } = await req.supabase
      .from('doctors')
      .select('*')
      .eq('org_id', orgId)
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

// GET /api/doctors/me/availability
router.get('/doctors/me/availability', authMiddleware, async (req, res) => {
  try {
    const { data: doctor } = await req.supabase
      .from('doctors').select('id').eq('user_id', req.user.userId).single();
    if (!doctor) return res.status(404).json({ error: 'Médico no encontrado' });

    const { data, error } = await req.supabase
      .from('doctor_availability').select('*').eq('doctor_id', doctor.id).order('day_of_week');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/doctors/me/availability — reemplaza toda la disponibilidad
router.post('/doctors/me/availability', authMiddleware, async (req, res) => {
  try {
    const { data: doctor } = await req.supabase
      .from('doctors').select('id').eq('user_id', req.user.userId).single();
    if (!doctor) return res.status(404).json({ error: 'Médico no encontrado' });

    const { availability } = req.body;
    await req.supabase.from('doctor_availability').delete().eq('doctor_id', doctor.id);

    if (availability && availability.length > 0) {
      const rows = availability.map(a => ({
        doctor_id: doctor.id, org_id: req.user.orgId,
        day_of_week: a.day_of_week, start_time: a.start_time, end_time: a.end_time, is_available: true,
      }));
      await req.supabase.from('doctor_availability').insert(rows);
    }
    res.json({ message: 'Disponibilidad actualizada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
