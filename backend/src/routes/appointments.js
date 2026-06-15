const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// ==========================================
// Helper: Obtener rol del usuario
// ==========================================
async function getUserRole(supabase, userId) {
  const { data: user, error } = await supabase
    .from('auth_users')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !user) return null;
  return user.role;
}

// ==========================================
// GET /api/appointments — Listar citas
// ==========================================
router.get('/appointments', authMiddleware, async (req, res) => {
  try {
    const role = await getUserRole(req.supabase, req.user.userId);
    const { status, date } = req.query; // ?status=scheduled&date=2024-01-15
    
    let query = req.supabase
      .from('appointments')
      .select('*, doctors(first_name, last_name, specialty), patients(first_name, last_name, email)')
      .eq('org_id', req.user.orgId);
    
    // Filtrar por rol
    if (role === 'doctor') {
      // Doctor solo ve sus citas
      const { data: doctor } = await req.supabase
        .from('doctors')
        .select('id')
        .eq('user_id', req.user.userId)
        .single();
      
      if (!doctor) {
        return res.status(403).json({ error: 'Doctor profile not found' });
      }
      
      query = query.eq('doctor_id', doctor.id);
    }
    
    // Filtros adicionales
    if (status) {
      query = query.eq('status', status);
    }
    
    if (date) {
      query = query
        .gte('scheduled_at', `${date}T00:00:00`)
        .lte('scheduled_at', `${date}T23:59:59`);
    }
    
    // Ordenar por fecha
    query = query.order('scheduled_at', { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to fetch appointments',
        details: error.message 
      });
    }
    
    res.json({
      count: data.length,
      role,
      appointments: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/appointments/:id — Ver detalle de cita
// ==========================================
router.get('/appointments/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const role = await getUserRole(req.supabase, req.user.userId);
    
    let query = req.supabase
      .from('appointments')
      .select('*, doctors(first_name, last_name, last_name_maternal, specialty, license_number, signature_url, user_id), patients(first_name, last_name, email, birth_date, phone, allergies, blood_type)')
      .eq('id', id)
      .eq('org_id', req.user.orgId);
    
    // Si es doctor, solo su cita
    if (role === 'doctor') {
      const { data: doctor } = await req.supabase
        .from('doctors')
        .select('id')
        .eq('user_id', req.user.userId)
        .single();
      
      if (doctor) {
        query = query.eq('doctor_id', doctor.id);
      }
    }
    
    const { data: appointment, error } = await query.single();
    
    if (error || !appointment) {
      return res.status(404).json({ 
        error: 'Appointment not found or access denied' 
      });
    }
    
    res.json({ appointment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// POST /api/appointments — Crear cita
// ==========================================
router.post('/appointments', authMiddleware, async (req, res) => {
  try {
    const role = await getUserRole(req.supabase, req.user.userId);
    
    // Solo secretarias y doctores pueden crear
    if (role !== 'secretary' && role !== 'doctor') {
      return res.status(403).json({ 
        error: 'Only secretaries and doctors can create appointments' 
      });
    }
    
    const { doctor_id, patient_id, scheduled_at, duration_minutes = 30, reason, notes } = req.body;
    
    // Validación
    if (!doctor_id || !patient_id || !scheduled_at) {
      return res.status(400).json({ 
        error: 'doctor_id, patient_id, and scheduled_at are required' 
      });
    }
    
    // Verificar que doctor y patient pertenecen a la clínica
    const { data: doctor } = await req.supabase
      .from('doctors')
      .select('id')
      .eq('id', doctor_id)
      .eq('org_id', req.user.orgId)
      .single();
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found in your organization' });
    }
    
    const { data: patient } = await req.supabase
      .from('patients')
      .select('id')
      .eq('id', patient_id)
      .eq('org_id', req.user.orgId)
      .single();
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found in your organization' });
    }
    
    // Verificar disponibilidad (no hay otra cita en ese horario)
    const { data: conflicting } = await req.supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', doctor_id)
      .eq('scheduled_at', scheduled_at)
      .eq('status', 'scheduled');
    
    if (conflicting && conflicting.length > 0) {
      return res.status(409).json({ 
        error: 'Doctor is not available at this time' 
      });
    }
    
    // Crear cita
    const { data: appointment, error } = await req.supabase
      .from('appointments')
      .insert([{
        org_id: req.user.orgId,
        doctor_id,
        patient_id,
        scheduled_at,
        duration_minutes,
        reason,
        notes,
        status: 'scheduled',
        created_by: req.user.userId
      }])
      .select('*, doctors(first_name, last_name), patients(first_name, last_name)')
      .single();
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to create appointment',
        details: error.message 
      });
    }
    
    res.status(201).json({
      message: 'Appointment created successfully',
      appointment
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PATCH /api/appointments/:id — Modificar cita
// ==========================================
router.patch('/appointments/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const role = await getUserRole(req.supabase, req.user.userId);
    
    // Obtener cita actual
    let query = req.supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('org_id', req.user.orgId);
    
    if (role === 'doctor') {
      const { data: doctor } = await req.supabase
        .from('doctors')
        .select('id')
        .eq('user_id', req.user.userId)
        .single();
      
      if (doctor) {
        query = query.eq('doctor_id', doctor.id);
      }
    }
    
    const { data: appointment, error: fetchError } = await query.single();
    
    if (fetchError || !appointment) {
      return res.status(404).json({ 
        error: 'Appointment not found or access denied' 
      });
    }
    
    // Solo secretarias pueden cambiar ciertos campos
    if (role !== 'secretary') {
      const allowedFields = ['notes']; // Doctores solo pueden editar notas
      const providedFields = Object.keys(req.body);
      const hasDisallowedFields = providedFields.some(f => !allowedFields.includes(f));
      
      if (hasDisallowedFields) {
        return res.status(403).json({ 
          error: 'Doctors can only edit notes' 
        });
      }
    }
    
    // Actualizar
    const { data: updated, error } = await req.supabase
      .from('appointments')
      .update(req.body)
      .eq('id', id)
      .select('*, doctors(first_name, last_name), patients(first_name, last_name)')
      .single();
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to update appointment',
        details: error.message 
      });
    }
    
    res.json({
      message: 'Appointment updated successfully',
      appointment: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DELETE /api/appointments/:id — Cancelar cita
// ==========================================
router.delete('/appointments/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const role = await getUserRole(req.supabase, req.user.userId);
    
    // Solo secretarias pueden cancelar
    if (role !== 'secretary') {
      return res.status(403).json({ 
        error: 'Only secretaries can cancel appointments' 
      });
    }
    
    // Obtener cita
    const { data: appointment } = await req.supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('org_id', req.user.orgId)
      .single();
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // No se pueden cancelar citas pasadas
    if (new Date(appointment.scheduled_at) < new Date()) {
      return res.status(400).json({ 
        error: 'Cannot cancel past appointments' 
      });
    }
    
    // Cancelar (actualizar status a 'cancelled')
    const { data: cancelled, error } = await req.supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to cancel appointment',
        details: error.message 
      });
    }
    
    res.json({
      message: 'Appointment cancelled successfully',
      appointment: cancelled
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;