const express = require('express');
const router = express.Router();
const { hashPassword, comparePasswords, generateToken } = require('../utils/auth');
const authMiddleware = require('../middleware/authMiddleware');

// ==========================================
// POST /auth/signup — Registrar usuario
// ==========================================
router.post('/signup', async (req, res) => {
  try {
    const { orgId, email, password } = req.body;

    // Validación
    if (!orgId || !email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['orgId', 'email', 'password']
      });
    }

    // Validar email
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validar contraseña (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Verificar que la organización existe
    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verificar que el email no existe ya en esta organización
    const { data: existingUser } = await req.supabase
      .from('auth_users')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ 
        error: 'User with this email already exists in this organization' 
      });
    }

    // Hashear contraseña
    const passwordHash = await hashPassword(password);

    // Crear usuario
    const { data: user, error } = await req.supabase
      .from('auth_users')
      .insert([
        {
          org_id: orgId,
          email: email,
          password_hash: passwordHash,
          role: 'secretary'
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ 
        error: 'Failed to create user',
        details: error.message 
      });
    }

    // Generar token
    const token = generateToken(user.id, user.org_id, user.email);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        orgId: user.org_id,
        role: user.role
      },
      token: token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        required: ['orgId', 'email', 'password']
      });
    }

    // Buscar usuario por org_id y email
    const { data: user, error } = await req.supabase
      .from('auth_users')
      .select('*')
      .eq('org_id', orgId)
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Invalid credentials'
      });
    }

    // Verificar que el usuario está activo
    if (user.status !== 'active') {
      return res.status(403).json({ 
        error: 'User account is not active'
      });
    }

    // Comparar contraseña
    const passwordMatch = await comparePasswords(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Invalid credentials'
      });
    }

    // Generar token
    const token = generateToken(user.id, user.org_id, user.email);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        orgId: user.org_id,
        role: user.role
      },
      token: token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GET /auth/me — Obtener usuario actual
// ==========================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // El token ya fue verificado en authMiddleware
    // req.user contiene la info del token
    
    // Obtener datos frescos de la base de datos
    const { data: user, error } = await req.supabase
      .from('auth_users')
      .select('*')
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
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;