const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { hashPassword } = require('../utils/auth');

// Todas las rutas de este modulo son solo para admin
router.use(authMiddleware, requireRole('admin'));

// ══ RESUMEN ═══════════════════════════════════════════════════
// GET /api/admin/overview — estadisticas generales de la clinica
router.get('/overview', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [patients, doctors, users, apptsMonth] = await Promise.all([
      req.supabase.from('patients').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      req.supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
      req.supabase.from('auth_users').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
      req.supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('scheduled_at', monthStart),
    ]);

    res.json({
      patients: patients.count || 0,
      doctors: doctors.count || 0,
      users: users.count || 0,
      appointments_month: apptsMonth.count || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ USUARIOS ══════════════════════════════════════════════════
// GET /api/admin/users — listar usuarios de la org
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await req.supabase
      .from('auth_users')
      .select('id, email, role, status, last_login, created_at')
      .eq('org_id', req.user.orgId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // Adjuntar nombre del doctor si tiene perfil
    const { data: doctors } = await req.supabase
      .from('doctors')
      .select('user_id, first_name, last_name, specialty')
      .eq('org_id', req.user.orgId);

    const withNames = (users || []).map(u => {
      const doc = (doctors || []).find(d => d.user_id === u.id);
      return { ...u, doctor_profile: doc || null };
    });

    res.json({ data: withNames });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/users — crear usuario (secretaria, medico o admin)
router.post('/users', async (req, res) => {
  try {
    const { email, password, role, first_name, last_name, specialty, license_number, phone } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, contraseña y rol son requeridos' });
    }
    if (!['admin', 'doctor', 'secretary'].includes(role)) {
      return res.status(400).json({ error: 'Rol invalido' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (role === 'doctor' && (!first_name || !last_name || !specialty)) {
      return res.status(400).json({ error: 'Para un medico se requiere nombre, apellido y especialidad' });
    }

    // Email unico global (el login sin orgId lo requiere)
    const { data: existing } = await req.supabase
      .from('auth_users').select('id').eq('email', email).limit(1);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Este correo ya esta registrado' });
    }

    const passwordHash = await hashPassword(password);
    const { data: user, error: userError } = await req.supabase
      .from('auth_users')
      .insert({ org_id: req.user.orgId, email, password_hash: passwordHash, role, status: 'active' })
      .select('id, email, role, status, created_at')
      .single();
    if (userError) return res.status(500).json({ error: userError.message });

    // Si es medico, crear su perfil en doctors
    let doctor = null;
    if (role === 'doctor') {
      const { data: doc, error: docError } = await req.supabase
        .from('doctors')
        .insert({
          org_id: req.user.orgId,
          user_id: user.id,
          first_name,
          last_name,
          specialty,
          license_number: license_number || null,
          phone: phone || null,
          active: true,
        })
        .select()
        .single();
      if (docError) {
        await req.supabase.from('auth_users').delete().eq('id', user.id);
        return res.status(500).json({ error: 'Error al crear el perfil del medico: ' + docError.message });
      }
      doctor = doc;
    }

    res.status(201).json({ message: 'Usuario creado', data: { ...user, doctor_profile: doctor } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/users/:id — cambiar rol o estado
router.put('/users/:id', async (req, res) => {
  try {
    const { role, status } = req.body;
    const updates = {};
    if (role) {
      if (!['admin', 'doctor', 'secretary'].includes(role)) {
        return res.status(400).json({ error: 'Rol invalido' });
      }
      updates.role = role;
    }
    if (status) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Estado invalido' });
      }
      updates.status = status;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    // No puedes desactivarte ni quitarte el rol admin a ti mismo
    if (req.params.id === req.user.userId) {
      if (updates.status === 'inactive') {
        return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
      }
      if (updates.role && updates.role !== 'admin') {
        return res.status(400).json({ error: 'No puedes quitarte tu propio rol de administrador' });
      }
    }

    const { data, error } = await req.supabase
      .from('auth_users')
      .update(updates)
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select('id, email, role, status')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Usuario actualizado', data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/users/:id/password — restablecer contraseña
router.put('/users/:id/password', async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const hash = await hashPassword(new_password);
    const { data, error } = await req.supabase
      .from('auth_users')
      .update({ password_hash: hash })
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select('id, email')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Contraseña restablecida' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ MEDICOS ═══════════════════════════════════════════════════
// GET /api/admin/doctors — todos los medicos (incluye inactivos)
router.get('/doctors', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('doctors')
      .select('id, user_id, first_name, last_name, last_name_maternal, specialty, license_number, phone, active, created_at')
      .eq('org_id', req.user.orgId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/doctors/:id — editar medico (datos o activo)
router.put('/doctors/:id', async (req, res) => {
  try {
    const allowed = ['first_name', 'last_name', 'last_name_maternal', 'specialty', 'license_number', 'phone', 'active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }
    const { data, error } = await req.supabase
      .from('doctors')
      .update(updates)
      .eq('id', req.params.id)
      .eq('org_id', req.user.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Medico actualizado', data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ CLINICA ═══════════════════════════════════════════════════
// GET /api/admin/organization — datos de la clinica
router.get('/organization', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('organizations')
      .select('id, name, email, phone, address, city, rfc, razon_social, status, created_at')
      .eq('id', req.user.orgId)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/organization — actualizar datos de la clinica
router.put('/organization', async (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'address', 'city', 'rfc', 'razon_social'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (!updates.name && updates.name !== undefined) {
      return res.status(400).json({ error: 'El nombre de la clinica no puede estar vacio' });
    }
    const { data, error } = await req.supabase
      .from('organizations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.user.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Clinica actualizada', data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
