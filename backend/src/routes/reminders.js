const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// GET /api/reminders/preview — citas de mañana candidatas a recordatorio
router.get('/preview', authMiddleware, async (req, res) => {
  try {
    const tomorrow = getTomorrowDate();
    const { data, error } = await req.supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time, reason, status, reminder_sent_at,
        patients(id, first_name, last_name, phone),
        doctors(id, first_name, last_name, specialty)
      `)
      .eq('org_id', req.user.orgId)
      .eq('appointment_date', tomorrow)
      .in('status', ['scheduled', 'confirmed'])
      .order('start_time');

    if (error) return res.status(500).json({ error: error.message });

    const twilioConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );

    res.json({ data: data || [], tomorrow, twilio_configured: twilioConfigured });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders/send — envía SMS a citas de mañana
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { appointment_ids } = req.body;
    const tomorrow = getTomorrowDate();

    let query = req.supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time, status,
        patients(id, first_name, last_name, phone),
        doctors(id, first_name, last_name)
      `)
      .eq('org_id', req.user.orgId)
      .eq('appointment_date', tomorrow)
      .in('status', ['scheduled', 'confirmed']);

    if (appointment_ids?.length) query = query.in('id', appointment_ids);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const appointments = data || [];
    const results = [];

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return res.json({
        results: appointments.map(a => ({
          id: a.id,
          patient: `${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim(),
          phone: a.patients?.phone || null,
          status: 'skipped',
          reason: 'Twilio no configurado — agrega TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_PHONE_NUMBER al .env',
        })),
        sent: 0,
        total: appointments.length,
        twilio_configured: false,
      });
    }

    const twilio = require('twilio')(accountSid, authToken);

    for (const appt of appointments) {
      const phone    = appt.patients?.phone;
      const name     = appt.patients?.first_name || 'paciente';
      const doctor   = appt.doctors ? `Dr. ${appt.doctors.first_name} ${appt.doctors.last_name}` : 'su médico';
      const timeStr  = formatTime(appt.start_time);
      const fullName = `${appt.patients?.first_name || ''} ${appt.patients?.last_name || ''}`.trim();

      if (!phone) {
        results.push({ id: appt.id, patient: fullName, phone: null, status: 'skipped', reason: 'Sin número de teléfono' });
        continue;
      }

      const body = `Hola ${name}, te recordamos tu cita con ${doctor} mañana a las ${timeStr}. Si necesitas cancelar o reprogramar, comunícate con nosotros. — Nōta`;
      const toNumber = phone.startsWith('+') ? phone : `+52${phone.replace(/\D/g, '')}`;

      try {
        await twilio.messages.create({ body, from: fromNumber, to: toNumber });

        // Actualiza reminder_sent_at si la columna existe (falla silenciosamente si no)
        await req.supabase
          .from('appointments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', appt.id)
          .catch(() => {});

        results.push({ id: appt.id, patient: fullName, phone, status: 'sent' });
      } catch (err) {
        results.push({ id: appt.id, patient: fullName, phone, status: 'error', reason: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    res.json({ results, sent, total: appointments.length, twilio_configured: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
