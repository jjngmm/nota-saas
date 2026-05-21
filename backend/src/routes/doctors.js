const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

router.post('/doctors', authMiddleware, async (req, res) => {
  try {
    // Solo admin puede crear doctors directamente
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Unauthorized',
        details: 'Only admins can create doctors directly. Doctors must request approval.'
      });
    }

    const { first_name, last_name, specialty, license_number, phone, bio } = req.body;
    const org_id = req.user.orgId;
    const user_id = req.user.userId;

    if (!first_name || !last_name || !specialty || !license_number) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'first_name, last_name, specialty, and license_number are required'
      });
    }

    const { data, error } = await req.supabase
      .from('doctors')
      .insert([{
        org_id: org_id,
        user_id: user_id,
        first_name: first_name,
        last_name: last_name,
        specialty: specialty,
        license_number: license_number,
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
