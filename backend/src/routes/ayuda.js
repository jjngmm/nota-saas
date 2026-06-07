const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/ayuda/sugerencia
router.post('/sugerencia', authMiddleware, async (req, res) => {
  try {
    const { categoria, titulo, mensaje } = req.body;
    if (!titulo || !mensaje) {
      return res.status(400).json({ error: 'Título y mensaje son requeridos' });
    }

    const { data, error } = await req.supabase
      .from('sugerencias')
      .insert({
        user_id: req.user.userId,
        org_id: req.user.orgId,
        categoria: categoria || 'general',
        titulo,
        mensaje,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ data, message: 'Sugerencia enviada. ¡Gracias!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
