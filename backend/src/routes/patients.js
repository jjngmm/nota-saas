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
// GET /api/patients — Listar pacientes
// ==========================================
router.get('/patients', authMiddleware, async (req, res) => {
  try {
    // Obtener rol del usuario
    const role = await getUserRole(req.supabase, req.user.userId);
    
    // Solo secretarias pueden ver TODOS los pacientes
    if (role === 'secretary') {
      const { data, error } = await req.supabase
        .from('patients')
        .select('*')
        .eq('org_id', req.user.orgId)
        .eq('active', true);
      
      if (error) {
        return res.status(500).json({ 
          error: 'Failed to fetch patients',
          details: error.message 
        });
      }
      
      return res.json({
        count: data.length,
        role: 'secretary',
        patients: data
      });
    }
    
    // Doctores ven solo sus pacientes
    if (role === 'doctor') {
      const { data: doctor } = await req.supabase
        .from('doctors')
        .select('id')
        .eq('user_id', req.user.userId)
        .single();
      
      if (!doctor) {
        return res.status(403).json({ 
          error: 'Doctor profile not found' 
        });
      }
      
      // Pacientes del doctor
      const { data, error } = await req.supabase
        .from('appointments')
        .select('patients(*)')
        .eq('doctor_id', doctor.id)
        .eq('org_id', req.user.orgId);
      
      if (error) {
        return res.status(500).json({ 
          error: 'Failed to fetch patients',
          details: error.message 
        });
      }
      
      return res.json({
        count: data.length,
        role: 'doctor',
        patients: data
      });
    }
    
    // Otros roles no tienen acceso
    res.status(403).json({ 
      error: 'Access denied',
      message: `Role '${role}' cannot view patients` 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /api/patients/:id — Ver detalle de paciente
// ==========================================
router.get('/patients/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const role = await getUserRole(req.supabase, req.user.userId);
    
    // Obtener paciente
    const { data: patient, error } = await req.supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .eq('org_id', req.user.orgId)
      .single();
    
    if (error || !patient) {
      return res.status(404).json({ 
        error: 'Patient not found' 
      });
    }
    
    // Si es doctor, verificar que tiene cita con este paciente
    if (role === 'doctor') {
      const { data: doctor } = await req.supabase
        .from('doctors')
        .select('id')
        .eq('user_id', req.user.userId)
        .single();
      
      const { data: appointment } = await req.supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctor.id)
        .eq('patient_id', id)
        .single();
      
      if (!appointment) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have appointments with this patient' 
        });
      }
    }
    
    res.json({ patient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// POST /api/patients — Crear paciente
// ==========================================
router.post('/patients', authMiddleware, async (req, res) => {
  try {
    const role = await getUserRole(req.supabase, req.user.userId);
    
    // Solo secretarias pueden crear pacientes
    if (role !== 'secretary') {
      return res.status(403).json({ 
        error: 'Only secretaries can create patients' 
      });
    }
    
    const { first_name, last_name, email, phone, birth_date } = req.body;
    
    // Validación
    if (!first_name || !last_name) {
      return res.status(400).json({ 
        error: 'first_name and last_name are required' 
      });
    }
    
    const { data: patient, error } = await req.supabase
      .from('patients')
      .insert([{
        org_id: req.user.orgId,
        first_name,
        last_name,
        email,
        phone,
        birth_date,
        active: true
      }])
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ 
        error: 'Failed to create patient',
        details: error.message 
      });
    }
    
    res.status(201).json({
      message: 'Patient created successfully',
      patient
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PATCH /api/patients/:id — Editar paciente
// ==========================================
router.patch('/patients/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const role = await getUserRole(req.supabase, req.user.userId);
    
    // Solo secretarias pueden editar
    if (role !== 'secretary') {
      return res.status(403).json({ 
        error: 'Only secretaries can edit patients' 
      });
    }
    
    const { data: patient, error } = await req.supabase
      .from('patients')
      .update(req.body)
      .eq('id', id)
      .eq('org_id', req.user.orgId)
      .select()
      .single();
    
    if (error || !patient) {
      return res.status(404).json({ 
        error: 'Patient not found or access denied' 
      });
    }
    
    res.json({
      message: 'Patient updated successfully',
      patient
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;