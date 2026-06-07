const express = require('express');
const router = express.Router();
const { hashPassword, generateToken } = require('../utils/auth');

// POST /api/auth/doctor-register
// Registro público de médico: crea org propia + auth_user + doctor
router.post('/doctor-register', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      last_name_maternal,
      phone,
      gender,
      specialty,
      email,
      password,
      how_did_you_hear,
      accepted_terms,
      accepted_data_transfer,
    } = req.body;

    // Validación básica
    if (!first_name || !last_name || !email || !password || !specialty) {
      return res.status(400).json({ error: 'Nombre, apellido, especialidad, email y contraseña son requeridos' });
    }
    if (!accepted_terms) {
      return res.status(400).json({ error: 'Debes aceptar los términos y condiciones' });
    }
    if (!accepted_data_transfer) {
      return res.status(400).json({ error: 'Debes aceptar la transferencia de datos personales' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Verificar que el email no exista ya
    const { data: existing } = await req.supabase
      .from('auth_users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Este correo ya está registrado' });
    }

    // 1. Crear organización propia del médico
    const orgName = `Consultorio ${first_name} ${last_name}`;
    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .insert({ name: orgName, status: 'active' })
      .select()
      .single();

    if (orgError) {
      return res.status(500).json({ error: 'Error al crear la organización', details: orgError.message });
    }

    // 2. Crear auth_user
    const passwordHash = await hashPassword(password);
    const { data: user, error: userError } = await req.supabase
      .from('auth_users')
      .insert({
        org_id: org.id,
        email,
        password_hash: passwordHash,
        role: 'doctor',
        status: 'active',
      })
      .select()
      .single();

    if (userError) {
      // Limpiar org creada si falla el usuario
      await req.supabase.from('organizations').delete().eq('id', org.id);
      return res.status(500).json({ error: 'Error al crear el usuario', details: userError.message });
    }

    // 3. Crear doctor
    const { data: doctor, error: doctorError } = await req.supabase
      .from('doctors')
      .insert({
        org_id: org.id,
        user_id: user.id,
        first_name,
        last_name,
        last_name_maternal: last_name_maternal || null,
        phone: phone || null,
        gender: gender || null,
        specialty,
        how_did_you_hear: how_did_you_hear || null,
        accepted_terms: !!accepted_terms,
        accepted_data_transfer: !!accepted_data_transfer,
        active: true,
      })
      .select()
      .single();

    if (doctorError) {
      await req.supabase.from('auth_users').delete().eq('id', user.id);
      await req.supabase.from('organizations').delete().eq('id', org.id);
      return res.status(500).json({ error: 'Error al crear el perfil del médico', details: doctorError.message });
    }

    const token = generateToken(user.id, org.id, email);

    res.status(201).json({
      message: 'Registro exitoso',
      user: { id: user.id, email: user.email, orgId: org.id, role: 'doctor', orgName: org.name },
      doctor: { id: doctor.id, first_name, last_name, specialty },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
});

module.exports = router;
