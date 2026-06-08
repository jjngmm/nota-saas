const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { hashPassword, generateToken } = require('../utils/auth');

// ==========================================
// POST /api/auth/register — Registro con rol
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { orgId, email, password, role, full_name, specialty, license_number } = req.body;

    if (!orgId || !email || !password || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orgId, email, password, and role are required'
      });
    }

    const validRoles = ['patient', 'doctor', 'secretary'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        details: 'Role must be one of: patient, doctor, secretary'
      });
    }

    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

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

    const passwordHash = await hashPassword(password);

    if (role === 'patient') {
      const { data: user, error: userError } = await req.supabase
        .from('auth_users')
        .insert([{
          org_id: orgId,
          email,
          password_hash: passwordHash,
          role: 'patient',
          status: 'active'
        }])
        .select()
        .single();

      if (userError) {
        return res.status(500).json({
          error: 'Failed to create account',
          details: userError.message
        });
      }

      const token = generateToken(user.id, orgId, email, user.role);

      return res.status(201).json({
        message: 'Patient account created successfully',
        user: {
          id: user.id,
          email: user.email,
          orgId: user.org_id,
          role: user.role
        },
        token
      });
    }

    const { data: request, error: requestError } = await req.supabase
      .from('signup_requests')
      .insert([{
        org_id: orgId,
        email,
        password_hash: passwordHash,
        role,
        full_name: full_name || null,
        specialty: specialty || null,
        license_number: license_number || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (requestError) {
      return res.status(500).json({
        error: 'Failed to submit registration request',
        details: requestError.message
      });
    }

    res.status(201).json({
      message: 'Registration request submitted. Awaiting ' + role + ' approval.',
      request: {
        id: request.id,
        email: request.email,
        role: request.role,
        status: request.status
      }
    });
  } catch (err) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

router.get('/signup-requests', authMiddleware, async (req, res) => {
  try {
    const org_id = req.user.orgId;

    if (!['admin', 'secretary'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Unauthorized',
        details: 'Only admins and secretaries can view signup requests'
      });
    }

    const { data, error } = await req.supabase
      .from('signup_requests')
      .select('*')
      .eq('org_id', org_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        error: 'Failed to fetch requests',
        details: error.message
      });
    }

    res.json({
      count: data.length,
      requests: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approve-signup/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;

    if (!['admin', 'secretary'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Unauthorized',
        details: 'Only admins and secretaries can approve signup requests'
      });
    }

    const { data: request, error: requestError } = await req.supabase
      .from('signup_requests')
      .select('*')
      .eq('id', requestId)
      .eq('org_id', req.user.orgId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        error: 'Request already processed',
        details: 'Status is ' + request.status
      });
    }

    const { data: user, error: userError } = await req.supabase
      .from('auth_users')
      .insert([{
        org_id: request.org_id,
        email: request.email,
        password_hash: request.password_hash,
        role: request.role,
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

    const { error: updateError } = await req.supabase
      .from('signup_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to update request',
        details: updateError.message
      });
    }

    res.json({
      message: request.role + ' account approved and created',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reject-signup/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    if (!['admin', 'secretary'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Unauthorized',
        details: 'Only admins and secretaries can reject signup requests'
      });
    }

    const { data: request, error: requestError } = await req.supabase
      .from('signup_requests')
      .select('*')
      .eq('id', requestId)
      .eq('org_id', req.user.orgId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        error: 'Request already processed',
        details: 'Status is ' + request.status
      });
    }

    const { error: updateError } = await req.supabase
      .from('signup_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to update request',
        details: updateError.message
      });
    }

    res.json({
      message: 'Registration request rejected',
      reason: reason || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
