const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { hashPassword, comparePasswords, generateToken } = require('../utils/auth');

// ==========================================
// POST /auth/signup — Crear usuario
// ==========================================
router.post('/signup', async (req, res) => {
  try {
    const { orgId, email, password } = req.body;

    // Validación
    if (!orgId || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orgId, email, and password are required'
      });
    }

    // Verificar que la organización existe
    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    // Verificar que el email no existe
    const { data: existingUser } = await req.supabase
      .from('auth_users')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        details: 'Email is already registered'
      });
    }

    // Hash de la password
    const passwordHash = await hashPassword(password);

    // Crear usuario
    const { data: user, error: userError } = await req.supabase
      .from('auth_users')
      .insert([{
        org_id: orgId,
        email,
        password_hash: passwordHash,
        role: 'secretary',
        status: 'active'
      }])
      .select()
      .single();

    if (userError) {
      return res.status(500).json({
        error: 'Failed to create user',
        details: userError.message
      });
    }

    // Generar token
    const token = generateToken(user.id, orgId, email);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        orgId: user.org_id,
        role: user.role
      },
      token
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

// ==========================================
// POST /auth/login — Iniciar sesión
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { orgId, email, password } = req.body;

    // Validación
    if (!orgId || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orgId, email, and password are required'
      });
    }

    // Verificar que la organización existe
    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    // Buscar usuario
    const { data: user, error: userError } = await req.supabase
      .from('auth_users')
      .select('*')
      .eq('org_id', orgId)
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Verificar status
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'User account is inactive'
      });
    }

    // Comparar contraseña
    const isPasswordValid = await comparePasswords(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Generar token
    const token = generateToken(user.id, orgId, email);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        orgId: user.org_id,
        role: user.role
      },
      token
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

// ==========================================
// GET /auth/me — Obtener usuario actual
// ==========================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // authMiddleware ya verificó el token y estableció req.user
    const { data: user, error } = await req.supabase
      .from('auth_users')
      .select('id, email, org_id, role')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        orgId: user.org_id,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

module.exports = router;
// ==========================================
// GET /auth/verify — Verificar token
// ==========================================
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    res.json({ 
      user: req.user,
      message: 'Token is valid' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
