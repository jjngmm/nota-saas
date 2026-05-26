const express = require('express');
const router = express.Router();

const normalize = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const generarSlots = (doctors, availabilities, targetDate) => {
  const slots = [];
  const horarios = ['09:00', '11:00', '14:00', '16:00'];

  for (const doc of doctors.slice(0, 2)) {
    if (slots.length >= 3) break;
    const avail = availabilities?.find(a => a.doctor_id === doc.id);
    if (!avail) continue;

    for (let i = 0; i < horarios.length && slots.length < 3; i++) {
      const [hour, minute] = horarios[i].split(':').map(Number);
      const slotTime = new Date(targetDate);
      slotTime.setHours(hour, minute, 0, 0);

      slots.push({
        medico_key: `${normalize(doc.first_name)}_${normalize(doc.last_name)}`,
        nombre_medico: `${doc.first_name} ${doc.last_name}`,
        especialidad: doc.specialty,
        fecha: slotTime.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        hora: slotTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
        fecha_iso: slotTime.toISOString(),
        disponible: true
      });
    }
  }
  return slots;
};

const parsearFecha = (fecha_preferida) => {
  let targetDate = new Date();
  const fechaNorm = normalize(fecha_preferida);
  if (fechaNorm.includes('manana') || fechaNorm.includes('mañana')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (fechaNorm.includes('pasado')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (fechaNorm.includes('semana')) {
    targetDate.setDate(targetDate.getDate() + 7);
  } else {
    const parsed = new Date(fecha_preferida);
    if (!isNaN(parsed.getTime())) targetDate = parsed;
  }
  targetDate.setHours(0, 0, 0, 0);
  return targetDate;
};

router.post('/setup-clinic', async (req, res) => {
  try {
    const { orgId, clinicName, twilioNumber, greeting } = req.body;
    if (!orgId || !clinicName) return res.status(400).json({ error: 'Missing orgId or clinicName' });

    const { data, error } = await req.supabase
      .from('clinic_vapi_config')
      .upsert([{
        org_id: orgId,
        clinic_name: clinicName,
        twilio_number: twilioNumber || null,
        vapi_assistant_id: 'c89de3dd-11e6-4d92-b290-5fdcea5f9762',
        greeting_custom: greeting || `${clinicName}, buenos días, le habla Valeria. ¿En qué le puedo ayudar?`,
        active: true
      }])
      .select().single();

    if (error) throw error;
    res.json({ success: true, mensaje: `Valeria configurada para ${clinicName}`, data });
  } catch (err) {
    res.status(500).json({ error: err.message, success: false });
  }
});

router.post('/consultar-disponibilidad', async (req, res) => {
  try {
    const { especialidad, fecha_preferida, medico_preferido } = req.body;
    const org_id = req.body.org_id || 'f22be1dc-c15d-46fc-b5f0-dee1e597d7e5';

    if (!especialidad || !fecha_preferida) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'Faltan datos requeridos.'
      });
    }

    // 1. Traer TODOS los médicos activos
    const { data: allDoctors, error: doctorError } = await req.supabase
      .from('doctors')
      .select('id, first_name, last_name, specialty, active')
      .eq('org_id', org_id)
      .eq('active', true);

    if (doctorError || !allDoctors || allDoctors.length === 0) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'No hay médicos disponibles en esta clínica.'
      });
    }

    // 2. Filtrar por nombre o especialidad (sin acentos)
    let doctors = allDoctors;

    if (medico_preferido && medico_preferido.trim() !== '') {
      const searchTerm = normalize(medico_preferido);
      doctors = allDoctors.filter(d =>
        normalize(d.first_name).includes(searchTerm) ||
        normalize(d.last_name).includes(searchTerm) ||
        normalize(`${d.first_name} ${d.last_name}`).includes(searchTerm)
      );
    } else if (especialidad && normalize(especialidad) !== 'cualquiera') {
      const searchTerm = normalize(especialidad);
      doctors = allDoctors.filter(d =>
        normalize(d.specialty).includes(searchTerm) ||
        searchTerm.includes(normalize(d.specialty))
      );
    }

    if (doctors.length === 0) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: `No encontré médicos para "${especialidad}". ¿Otra especialidad o nombre?`
      });
    }

    // 3. Si hay múltiples y no se especificó médico → pedir aclaración
    if (doctors.length > 1 && (!medico_preferido || medico_preferido.trim() === '')) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: true,
        opciones_medicos: doctors.slice(0, 3).map(doc => ({
          nombre: `${doc.first_name} ${doc.last_name}`,
          especialidad: doc.specialty,
          medico_key: `${normalize(doc.first_name)}_${normalize(doc.last_name)}`
        })),
        mensaje: 'Encontré varios médicos. ¿Cuál prefieres?'
      });
    }

    // 4. Buscar disponibilidad
    const doctorIds = doctors.map(d => d.id);
    const { data: availabilities, error: availError } = await req.supabase
      .from('doctor_availability')
      .select('doctor_id, day_of_week, start_time, end_time, duration_minutes, is_available')
      .in('doctor_id', doctorIds);

    if (availError) {
      console.error('Availability error:', availError);
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'No hay disponibilidad en esta fecha. ¿Prefieres otra fecha?'
      });
    }

    // 5. Generar slots
    const targetDate = parsearFecha(fecha_preferida);
    const slots = generarSlots(doctors, availabilities, targetDate);

    if (slots.length === 0) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'No hay disponibilidad en esta fecha. ¿Prefieres otra fecha?'
      });
    }

    res.json({
      slots_disponibles: slots,
      requiere_aclaracion: false,
      mensaje: 'Aquí están los horarios disponibles.'
    });

  } catch (err) {
    console.error('Error en consultar-disponibilidad:', err);
    res.status(500).json({
      error: err.message,
      slots_disponibles: [],
      requiere_aclaracion: false,
      mensaje: 'Disculpa, algo salió mal. ¿Podrías intentar más tarde?'
    });
  }
});

router.post('/registrar-cita', async (req, res) => {
  try {
    const {
      medico_key, fecha_iso, paciente_nombre, paciente_edad,
      paciente_telefono, especialidad, confirmacion,
      motivo, duracion_minutos = 30, org_id
    } = req.body;

    if (!medico_key || !fecha_iso || !paciente_nombre || !confirmacion || !org_id) {
      return res.status(200).json({
        success: false,
        mensaje: 'Faltan datos requeridos para agendar la cita.'
      });
    }

    // 1. Buscar médico por medico_key normalizado
    const { data: allDoctors, error: docError } = await req.supabase
      .from('doctors')
      .select('id, first_name, last_name, specialty')
      .eq('org_id', org_id);

    if (docError || !allDoctors) {
      return res.status(200).json({ success: false, mensaje: 'No se encontró el médico.' });
    }

    const doctor = allDoctors.find(d =>
      `${normalize(d.first_name)}_${normalize(d.last_name)}` === normalize(medico_key)
    );

    if (!doctor) {
      console.error('Doctor not found for key:', medico_key);
      return res.status(200).json({ success: false, mensaje: 'No se encontró el médico. Por favor intenta de nuevo.' });
    }

    // 2. Crear paciente
    const nameParts = paciente_nombre.trim().split(' ');
    const { data: patient } = await req.supabase
      .from('patients')
      .insert([{
        org_id: org_id,
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || '',
        phone: paciente_telefono || null,
        active: true
      }])
      .select().single();

    // 3. Crear cita
    const appointmentDate = new Date(fecha_iso);
    const { data: appointment, error: aptError } = await req.supabase
      .from('appointments')
      .insert([{
        org_id: org_id,
        doctor_id: doctor.id,
        patient_id: patient?.id || null,
        scheduled_at: appointmentDate.toISOString(),
        duration_minutes: duracion_minutos,
        status: 'scheduled',
        appointment_type: 'in-person',
        reason: motivo || 'Consulta general',
        notes: `Agendado vía Valeria (canal: ${confirmacion})`,
        voice_call_id: req.headers['x-vapi-call-id'] || null
      }])
      .select().single();

    if (aptError) {
      console.error('Error creating appointment:', aptError);
      return res.status(200).json({ success: false, mensaje: 'No se pudo agendar la cita. Por favor intenta más tarde.' });
    }

    const fechaFormato = appointmentDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const horaFormato = appointmentDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

    res.json({
      success: true,
      id_confirmacion: appointment.id,
      confirmacion_codigo: `CLN-${appointment.id.substring(0, 8).toUpperCase()}`,
      mensaje: `Tu cita está agendada para el ${fechaFormato} a las ${horaFormato}.`,
      fecha: fechaFormato,
      hora: horaFormato,
      medico: `${doctor.first_name} ${doctor.last_name}`,
      especialidad: doctor.specialty || especialidad || 'General',
      canal_confirmacion: confirmacion,
      paciente_nombre: paciente_nombre
    });

  } catch (err) {
    console.error('Error en registrar-cita:', err);
    res.status(500).json({ success: false, mensaje: 'Disculpa, algo salió mal al agendar la cita.', error: err.message });
  }
});

router.post('/debug', async (req, res) => {
  const { org_id } = req.body;
  
  const { data: doctors } = await req.supabase
    .from('doctors')
    .select('id, first_name')
    .eq('org_id', org_id);

  const doctorIds = doctors.map(d => d.id);

  const { data: avail, error: availError } = await req.supabase
    .from('doctor_availability')
    .select('*')
    .in('doctor_id', doctorIds);

  // También probar con un ID directo
  const { data: availDirect, error: directError } = await req.supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', 'ffee5d67-d552-4ae5-a4f3-b518fbc89feb');

  res.json({ 
    doctorIds,
    avail, 
    availError,
    availDirect,
    directError
  });
});

module.exports = router;