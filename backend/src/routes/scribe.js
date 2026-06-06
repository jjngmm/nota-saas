const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Anthropic = require('@anthropic-ai/sdk');
const FormData = require('form-data');
const fetch = require('node-fetch');

// POST /api/scribe/transcribe
router.post('/transcribe', authMiddleware, async (req, res) => {
  try {
    const { audio } = req.body;
    if (!audio) return res.status(400).json({ error: 'audio base64 requerido' });

    const buffer = Buffer.from(audio, 'base64');
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    form.append('model', 'whisper-1');
    form.append('language', 'es');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Error en Whisper', details: err });
    }

    const result = await response.json();
    res.json({ transcript: result.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scribe/generate-soap
router.post('/generate-soap', authMiddleware, async (req, res) => {
  try {
    const { transcript, note_id } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript requerido' });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Eres un asistente médico. A partir de la siguiente transcripción de consulta, genera una nota SOAP estructurada en español. Responde SOLO con JSON válido con las claves: subjective, objective, assessment, plan. Cada campo debe ser texto clínico conciso y preciso.\n\nTranscripción:\n${transcript}`,
        },
      ],
    });

    const raw = message.content[0].text.trim();
    let soap;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      soap = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return res.status(500).json({ error: 'Claude no devolvió JSON válido', raw });
    }

    // Actualizar la nota clínica si se proporcionó note_id
    if (note_id) {
      await req.supabase
        .from('clinical_notes')
        .update({
          raw_transcript: transcript,
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', note_id)
        .eq('org_id', req.user.orgId);
    }

    res.json(soap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
