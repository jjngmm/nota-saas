const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Anthropic = require('@anthropic-ai/sdk');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function getDoctorId(supabase, userId) {
  const { data } = await supabase.from('doctors').select('id, first_name, last_name, specialty').eq('user_id', userId).single();
  return data || null;
}

// ── GET /api/forms — Listar formularios del médico
router.get('/', authMiddleware, async (req, res) => {
  try {
    const doc = await getDoctorId(req.supabase, req.user.userId);
    if (!doc) return res.status(404).json({ error: 'Médico no encontrado' });

    const { data, error } = await req.supabase
      .from('patient_forms')
      .select('id, title, description, is_active, share_token, expires_at, created_at, allow_anonymous')
      .eq('doctor_id', doc.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Contar respuestas por formulario
    const ids = (data || []).map(f => f.id);
    let counts = {};
    if (ids.length > 0) {
      const { data: resp } = await req.supabase
        .from('patient_form_responses')
        .select('form_id')
        .in('form_id', ids);
      (resp || []).forEach(r => { counts[r.form_id] = (counts[r.form_id] || 0) + 1; });
    }

    res.json({ data: (data || []).map(f => ({ ...f, response_count: counts[f.id] || 0 })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/forms/:id — Detalle con preguntas y respuestas
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await getDoctorId(req.supabase, req.user.userId);
    const { data: form, error } = await req.supabase
      .from('patient_forms')
      .select('*')
      .eq('id', req.params.id)
      .eq('doctor_id', doc.id)
      .single();

    if (error || !form) return res.status(404).json({ error: 'Formulario no encontrado' });

    const { data: responses } = await req.supabase
      .from('patient_form_responses')
      .select('*')
      .eq('form_id', form.id)
      .order('submitted_at', { ascending: false });

    res.json({ form, responses: responses || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/forms — Crear formulario
router.post('/', authMiddleware, async (req, res) => {
  try {
    const doc = await getDoctorId(req.supabase, req.user.userId);
    if (!doc) return res.status(404).json({ error: 'Médico no encontrado' });

    const { title, description, questions, expires_at, allow_anonymous } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es requerido' });

    const { data, error } = await req.supabase
      .from('patient_forms')
      .insert({ doctor_id: doc.id, org_id: req.user.orgId, title, description, questions: questions || [], expires_at: expires_at || null, allow_anonymous: allow_anonymous !== false })
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/forms/:id — Actualizar formulario
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await getDoctorId(req.supabase, req.user.userId);
    const { title, description, questions, is_active, expires_at, allow_anonymous } = req.body;

    const { data, error } = await req.supabase
      .from('patient_forms')
      .update({ title, description, questions, is_active, expires_at, allow_anonymous, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('doctor_id', doc.id)
      .select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/forms/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await getDoctorId(req.supabase, req.user.userId);
    await req.supabase.from('patient_forms').delete().eq('id', req.params.id).eq('doctor_id', doc.id);
    res.json({ message: 'Formulario eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/forms/parse-file — Extraer preguntas de Word/PDF con Claude
router.post('/parse-file', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const mime = req.file.mimetype;
    let texto = '';

    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mime === 'application/msword') {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      texto = result.value;
    } else if (mime === 'application/pdf') {
      const result = await pdfParse(req.file.buffer);
      texto = result.text;
    } else if (mime === 'text/plain') {
      texto = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Usa PDF, Word (.docx) o texto plano.' });
    }

    if (!texto.trim()) return res.status(400).json({ error: 'No se pudo extraer texto del archivo' });

    // Usar Claude para extraer preguntas estructuradas
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analiza el siguiente documento médico y extrae las preguntas o campos que debe contestar el paciente.
Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
  "titulo": "Título del formulario detectado o sugerido",
  "descripcion": "Breve descripción del formulario",
  "preguntas": [
    {
      "id": "q1",
      "tipo": "texto_corto|texto_largo|opcion_multiple|casillas|fecha|numero|escala",
      "pregunta": "Texto de la pregunta",
      "requerido": true|false,
      "opciones": ["opción 1", "opción 2"]  // solo para opcion_multiple y casillas
    }
  ]
}

Tipos de preguntas:
- texto_corto: para nombres, ciudades, respuestas breves
- texto_largo: para síntomas, descripciones, antecedentes
- opcion_multiple: cuando hay opciones excluyentes (Sí/No, opciones médicas)
- casillas: cuando pueden seleccionar múltiples opciones
- fecha: para fechas de nacimiento, inicio de síntomas
- numero: para edad, peso, talla, presión arterial
- escala: para dolor en escala del 1 al 10

Documento:
${texto.substring(0, 4000)}`,
      }],
    });

    const raw = message.content[0].text.trim();
    let parsed;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      return res.status(500).json({ error: 'Claude no pudo estructurar el formulario. Intenta con el constructor manual.' });
    }

    res.json({
      titulo: parsed.titulo || req.file.originalname.replace(/\.[^.]+$/, ''),
      descripcion: parsed.descripcion || '',
      preguntas: (parsed.preguntas || []).map((p, i) => ({
        id: `q${i + 1}`,
        tipo: p.tipo || 'texto_corto',
        pregunta: p.pregunta || '',
        requerido: p.requerido !== false,
        opciones: p.opciones || [],
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════
// RUTAS PÚBLICAS (sin auth — para pacientes)
// ══════════════════════════════════════════════════════

// GET /api/forms/public/:token — Ver formulario (paciente)
router.get('/public/:token', async (req, res) => {
  try {
    const { data: form, error } = await req.supabase
      .from('patient_forms')
      .select('id, title, description, questions, is_active, expires_at, allow_anonymous, doctor_id, doctors(first_name, last_name, specialty)')
      .eq('share_token', req.params.token)
      .single();

    if (error || !form) return res.status(404).json({ error: 'Formulario no encontrado' });
    if (!form.is_active) return res.status(403).json({ error: 'Este formulario ya no está disponible' });
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Este formulario ha expirado' });
    }

    res.json({ form });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/forms/public/:token/submit — Enviar respuestas (paciente)
router.post('/public/:token/submit', async (req, res) => {
  try {
    const { data: form, error } = await req.supabase
      .from('patient_forms')
      .select('id, is_active, expires_at')
      .eq('share_token', req.params.token)
      .single();

    if (error || !form) return res.status(404).json({ error: 'Formulario no encontrado' });
    if (!form.is_active) return res.status(403).json({ error: 'Formulario no disponible' });
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Formulario expirado' });
    }

    const { patient_name, patient_email, patient_phone, answers } = req.body;

    const { data, error: insertError } = await req.supabase
      .from('patient_form_responses')
      .insert({ form_id: form.id, patient_name, patient_email, patient_phone, answers })
      .select().single();

    if (insertError) return res.status(500).json({ error: insertError.message });
    res.status(201).json({ data, message: '¡Formulario enviado correctamente!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
