const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// ==========================================
// GET /api/doctors — Listar doctores de mi clínica
// ==========================================
router.get('/doctors', authMiddleware, async (req, res) => {
  try {
    // req.user = { userId, orgId, email }
    // Solo doctores de la clínica del usuario
    
    const { data, error } = await req.supabase
      .from('doctors')
      .select('*')
      .eq('org_id', req.user.orgId)
      .eq('active', true);
    
    if (error) {
      return res.status(500).json({ 
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

// ==========================================
// GET /api/doctors/:id — Ver detalle de doctor
// ==========================================
router.get('/doctors/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el doctor pertenece a mi clínica
    const { data, error } = await req.supabase
      .from('doctors')
      .select('*')
      .eq('id', id)
      .eq('org_id', req.user.orgId)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ 
        error: 'Doctor not found or access denied' 
      });
    }
    
    res.json({ doctor: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/doctors/:id/availability — Ver disponibilidad
// ==========================================
router.get('/doctors/:id/availability', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // ?date=2024-01-15
    
    if (!date) {
      return res.status(400).json({ 
        error: 'date parameter required',
        example: '/api/doctors/doctor-id/availability?date=2024-01-15'
      });
    }
    
    // Obtener citas del doctor ese día
    const { data: appointments, error } = await req.supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', id)
      .gte('scheduled_at', `${date}T00:00:00`)
      .lte('scheduled_at', `${date}T23:59:59`)
      .eq('org_id', req.user.orgId);
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to fetch availability',
        details: error.message 
      });
    }
    
    // Horario base: 9am a 5pm (8 hours = 16 slots de 30 min)
    const baseSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30'
    ];
    
    // Slots ocupados
    const occupiedTimes = appointments.map(apt => {
      const time = new Date(apt.scheduled_at).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
      return time;
    });
    
    // Slots disponibles
    const availableSlots = baseSlots.filter(slot => !occupiedTimes.includes(slot));
    
    res.json({
      date,
      doctor_id: id,
      available_slots: availableSlots,
      booked_count: occupiedTimes.length,
      total_slots: baseSlots.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;