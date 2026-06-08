const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { hashPassword, comparePasswords, generateToken } = require('../utils/auth');

// ==========================================
// GET /auth/orgs?q=nombre — Buscar organización
// ==========================================
router.get('/orgs', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ data: [] });
    }

    const { data, error } = await req.supabase
      .from('organizations')
      .select('id, name, city')
      .ilike('name', `%${q.trim()}%`)
      .eq('status', 'active')
      .limit(8);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// POST /auth/signup — Crear usuario
// ==========================================
router.post('/signup', async (req, res) => {
  try {
    const { orgId, email, password } = req.body;

    if (!orgId || !email || !password) {
      return res.status(400).json({ error: 'orgId, email y contraseña son requeridos' });
    }

    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    const { data: existingUser } = await req.supabase
      .from('auth_users')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'Este email ya está registrado en la organización' });
    }

    const passwordHash = await hashPassword(password);

    const { data: user, error: userError } = await req.supabase
      .from('auth_users')
      .insert([{ org_id: orgId, email, password_hash: passwordHash, role: 'secretary', status: 'active' }])
      .select()
      .single();

    if (userError) {
      return res.status(500).json({ error: 'Error al crear el usuario', details: userError.message });
    }

    const token = generateToken(user.id, orgId, email, user.role);

    res.status(201).json({
      message: 'Usuario creado correctamente',
      user: { id: user.id, email: user.email, orgId: user.org_id, role: user.role },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// POST /auth/login — Iniciar sesión
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { orgId, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    let resolvedOrgId = orgId;
    let org = null;

    if (resolvedOrgId) {
      // Verificar org por ID
      const { data: orgData, error: orgError } = await req.supabase
        .from('organizations')
        .select('id, name')
        .eq('id', resolvedOrgId)
        .single();
      if (orgError || !orgData) {
        return res.status(404).json({ error: 'Organización no encontrada' });
      }
      org = orgData;
    } else {
      // Sin orgId: buscar usuario por email en cualquier org
      const { data: users } = await req.supabase
        .from('auth_users')
        .select('*, organizations(id, name)')
        .eq('email', email)
        .eq('status', 'active');

      if (!users || users.length === 0) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }
      if (users.length > 1) {
        // Email en múltiples orgs — pedir que especifique clínica
        return res.status(409).json({
          error: 'Este email existe en varias clínicas. Selecciona tu clínica para continuar.',
          requiresOrg: true,
        });
      }
      resolvedOrgId = users[0].org_id;
      org = users[0].organizations;
    }

    const { data: user, error: userError } = await req.supabase
      .from('auth_users')
      .select('*')
      .eq('org_id', resolvedOrgId)
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Esta cuenta está inactiva. Contacta al administrador.' });
    }

    const isPasswordValid = await comparePasswords(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = generateToken(user.id, resolvedOrgId, email, user.role);

    res.status(200).json({
      message: 'Sesión iniciada correctamente',
      user: { id: user.id, email: user.email, orgId: user.org_id, role: user.role, orgName: org?.name },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// GET /auth/me — Usuario actual
// ==========================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await req.supabase
      .from('auth_users')
      .select('id, email, org_id, role')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ user: { id: user.id, email: user.email, orgId: user.org_id, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// GET /auth/verify — Verificar token
// ==========================================
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await req.supabase
      .from('auth_users')
      .select('id, email, org_id, role')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { data: org } = await req.supabase
      .from('organizations')
      .select('name')
      .eq('id', user.org_id)
      .single();

    res.json({
      user: { id: user.id, email: user.email, orgId: user.org_id, role: user.role, orgName: org?.name },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// POST /auth/refresh — Renovar token
// ==========================================
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await req.supabase
      .from('auth_users')
      .select('id, email, org_id, role')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const newToken = generateToken(user.id, user.org_id, user.email, user.role);

    res.json({
      user: { id: user.id, email: user.email, orgId: user.org_id, role: user.role },
      token: newToken,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
