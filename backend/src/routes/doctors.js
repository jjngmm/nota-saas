const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

router.post('/doctors', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { first_name, last_name, specialty, license_number, phone, bio } = req.body;

    if (!first_name || !last_name || !specialty || !license_number) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Construir objeto manualmente
    const doctorData = {
      org_id: req.user.orgId,
      user_id: req.user.userId,
      first_name: first_name,
      last_name: last_name,
      specialty: specialty,
      license_number: license_number,
      phone: phone || null,
      bio: bio || null,
      active: true
    };

    console.log('Inserting:', doctorData);

    const { data, error } = await req.supabase
      .from('doctors')
      .insert([doctorData])
      .select();

    if (error) {
      return res.status(400).json({
        error: 'Failed to create doctor',
        details: error.message,
        code: error.code
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
    const { data, error } = await req.supabase
      .from('doctors')
      .select('*')
      .eq('org_id', req.user.orgId)
      .eq('active', true);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ count: data.length, doctors: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
