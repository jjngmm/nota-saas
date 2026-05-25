const express = require('express');
const router = express.Router();

/**
 * POST /api/valeria/setup-clinic
 * Configura Valeria para una clínica específica
 */
router.post('/setup-clinic', async (req, res) => {
  try {
    const { orgId, clinicName, twilioNumber, greeting } = req.body;

    if (!orgId || !clinicName) {
      return res.status(400).json({
        error: 'Missing orgId or clinicName'
      });
    }

    // Guardar en tabla clinic_vapi_config
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
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      mensaje: `Valeria está configurada para ${clinicName}`,
      data
    });
  } catch (err) {
    console.error('Error en setup-clinic:', err);
    res.status(500).json({ 
      error: err.message,
      success: false
    });
  }
});

/**
 * POST /api/valeria/consultar-disponibilidad
 * Consulta slots disponibles para un médico o especialidad
 * Vapi llama esto cuando el usuario dice qué médico/especialidad quiere
 */
router.post('/consultar-disponibilidad', async (req, res) => {
  try {
    const { especialidad, fecha_preferida, medico_preferido } = req.body;

    // Validar inputs
    if (!especialidad || !fecha_preferida) {
      return res.status(200).json({
        error: 'Missing especialidad or fecha_preferida',
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'Por favor proporciona especialidad y fecha.'
      });
    }

    // Obtener org_id de headers o parámetro
    let orgId = req.headers['x-clinic-id'] || req.body.org_id || 'f22be1dc-c15d-46fc-b5f0-dee1e597d7e5';
    
    // Si viene número Twilio, buscar la clínica asociada
    if (req.headers['x-twilio-number'] && !req.headers['x-clinic-id']) {
      const { data: config } = await req.supabase
        .from('clinic_vapi_config')
        .select('org_id')
        .eq('twilio_number', req.headers['x-twilio-number'])
        .single();
      
      if (config) orgId = config.org_id;
    }

    // 1. Buscar médicos que coincidan
    let doctorsQuery = req.supabase
      .from('doctors')
      .select('id, first_name, last_name, specialty, active')
      .eq('org_id', orgId)
      .eq('active', true);

    // Si se especificó médico preferido, filtrar por nombre
    if (medico_preferido && medico_preferido.trim() !== '') {
      doctorsQuery = doctorsQuery.or(
        `first_name.ilike.%${medico_preferido}%,last_name.ilike.%${medico_preferido}%`
      );
    } else if (especialidad && especialidad.toLowerCase() !== 'cualquiera') {
      // Si se especificó especialidad, filtrar
      doctorsQuery = doctorsQuery.ilike('specialty', `%${especialidad}%`);
    }

    const { data: doctors, error: doctorError } = await doctorsQuery;

    if (doctorError) {
      console.error('Doctor query error:', doctorError);
      return res.status(200).json({
        error: doctorError.message,
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'Disculpa, no puedo consultar disponibilidad en este momento.'
      });
    }

    // Si no se encontraron médicos
    if (!doctors || doctors.length === 0) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: `No encontré médicos disponibles en la especialidad "${especialidad}". ¿Podrías especificar otra especialidad o un nombre de médico?`
      });
    }

    // Si se encontraron múltiples médicos y NO se especificó nombre exacto, pedir aclaración
    if (doctors.length > 1 && (!medico_preferido || medico_preferido.trim() === '')) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: true,
        opciones_medicos: doctors.slice(0, 3).map(doc => ({
          nombre: `${doc.first_name} ${doc.last_name}`,
          especialidad: doc.specialty,
          medico_key: `${doc.first_name.toLowerCase()}_${doc.last_name.toLowerCase()}`
        })),
        mensaje: `Encontré varios médicos. ¿Cuál prefieres?`
      });
    }

    // Ahora buscar disponibilidad para los médicos encontrados
    const doctorIds = doctors.map(d => d.id);

    // Parsear fecha preferida
    let targetDate = new Date();
    if (fecha_preferida.toLowerCase().includes('mañana')) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (fecha_preferida.toLowerCase().includes('hoy')) {
      // targetDate ya es hoy
    } else if (!isNaN(new Date(fecha_preferida).getTime())) {
      targetDate = new Date(fecha_preferida);
    }

    // Asegurarse de que la fecha sea válida
    targetDate.setHours(0, 0, 0, 0);

    // Obtener slots disponibles de doctor_availability
    const { data: availabilities, error: availError } = await req.supabase
      .from('doctor_availability')
      .select('doctor_id, day_of_week, start_time, end_time, duration_minutes')
      .in('doctor_id', doctorIds);

    if (availError) {
      console.error('Availability query error:', availError);
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'No hay disponibilidad en esta fecha. ¿Prefieres otra fecha?'
      });
    }

    // Generar slots (3 opciones por médico)
    const slots = [];
    for (const doc of doctors.slice(0, 2)) {
      const avail = availabilities.find(a => a.doctor_id === doc.id);
      if (!avail) continue;

      // Generar 3 horarios: 9:00, 11:00, 14:00
      const horarios = ['09:00', '11:00', '14:00'];
      for (let i = 0; i < horarios.length && slots.length < 3; i++) {
        const [hour, minute] = horarios[i].split(':').map(Number);
        const slotTime = new Date(targetDate);
        slotTime.setHours(hour, minute, 0, 0);

        // Formato legible para Valeria
        const fechaLegible = slotTime.toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const horaLegible = slotTime.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        slots.push({
          medico_key: `${doc.first_name.toLowerCase()}_${doc.last_name.toLowerCase()}`,
          nombre_medico: `${doc.first_name} ${doc.last_name}`,
          especialidad: doc.specialty,
          fecha: fechaLegible,
          hora: horaLegible,
          fecha_iso: slotTime.toISOString(),
          disponible: true
        });
      }
    }

    if (slots.length === 0) {
      return res.status(200).json({
        slots_disponibles: [],
        requiere_aclaracion: false,
        mensaje: 'No hay disponibilidad en esta fecha. ¿Prefieres otra fecha?'
      });
    }

    res.json({
      slots_disponibles: slots.slice(0, 3),
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

/**
 * POST /api/valeria/registrar-cita
 * Registra la cita en la BD después de que el paciente confirma
 * Vapi llama esto con todos los datos del paciente y cita
 */
router.post('/registrar-cita', async (req, res) => {
  try {
    const {
      medico_key,
      fecha_iso,
      paciente_nombre,
      paciente_edad,
      paciente_telefono,
      especialidad,
      confirmacion,
      motivo,
      duracion_minutos = 30
    } = req.body;

    // Validar requeridos
    if (!medico_key || !fecha_iso || !paciente_nombre || !confirmacion) {
      return res.status(200).json({
        success: false,
        mensaje: 'Faltan datos requeridos para agendar la cita.'
      });
    }

    // Obtener org_id
    let orgId = req.headers['x-clinic-id'] || req.body.org_id || 'f22be1dc-c15d-46fc-b5f0-dee1e597d7e5';
    
    if (req.headers['x-twilio-number'] && !req.headers['x-clinic-id']) {
      const { data: config } = await req.supabase
        .from('clinic_vapi_config')
        .select('org_id')
        .eq('twilio_number', req.headers['x-twilio-number'])
        .single();
      
      if (config) orgId = config.org_id;
    }

    // 1. Buscar el médico por medico_key (ej: "arturo_vega")
    const parts = medico_key.split('_');
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const lastName = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    const { data: doctor, error: docError } = await req.supabase
      .from('doctors')
      .select('id, first_name, last_name, specialty')
      .eq('org_id', orgId)
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .single();

    if (docError || !doctor) {
      console.error('Doctor not found:', docError);
      return res.status(200).json({
        success: false,
        mensaje: 'No se encontró el médico. Por favor intenta de nuevo.'
      });
    }

    // 2. Crear paciente en la BD (si no existe, lo creamos)
    const nameParts = paciente_nombre.trim().split(' ');
    const patientFirstName = nameParts[0];
    const patientLastName = nameParts.slice(1).join(' ') || '';

    const { data: patient, error: patientError } = await req.supabase
      .from('patients')
      .insert([{
        org_id: orgId,
        first_name: patientFirstName,
        last_name: patientLastName,
        phone: paciente_telefono || null,
        active: true
      }])
      .select()
      .single();

    if (patientError) {
      console.error('Error creating patient:', patientError);
    }

    const patientId = patient?.id || null;

    // 3. Crear cita en appointments
    const appointmentDate = new Date(fecha_iso);

    const { data: appointment, error: aptError } = await req.supabase
      .from('appointments')
      .insert([{
        org_id: orgId,
        doctor_id: doctor.id,
        patient_id: patientId,
        scheduled_at: appointmentDate.toISOString(),
        duration_minutes: duracion_minutos,
        status: 'scheduled',
        appointment_type: 'in-person',
        reason: motivo || 'Consulta general',
        notes: `Agendado vía Valeria (confirmación: ${confirmacion})`,
        voice_call_id: req.headers['x-vapi-call-id'] || null,
        confirmation_channel: confirmacion,
        confirmation_sent_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (aptError) {
      console.error('Error creating appointment:', aptError);
      return res.status(200).json({
        success: false,
        mensaje: 'No se pudo agendar la cita. Por favor intenta más tarde.'
      });
    }

    // 4. TODO: Enviar confirmación (SMS/WhatsApp)
    if (confirmacion === 'sms' && paciente_telefono) {
      console.log(`[SMS] Enviando confirmación a ${paciente_telefono}`);
      // await sendSMS(paciente_telefono, confirmation_message);
    } else if (confirmacion === 'whatsapp' && paciente_telefono) {
      console.log(`[WhatsApp] Enviando confirmación a ${paciente_telefono}`);
      // await sendWhatsApp(paciente_telefono, confirmation_message);
    }

    // 5. Retornar confirmación en formato legible (SIN AÑO)
    const fechaFormato = appointmentDate.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const horaFormato = appointmentDate.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    res.json({
      success: true,
      id_confirmacion: appointment.id,
      confirmacion_codigo: `CLN-${appointment.id.substring(0, 8).toUpperCase()}`,
      mensaje: `Perfecto, tu cita está agendada para el ${fechaFormato} a las ${horaFormato}.`,
      fecha: fechaFormato,
      hora: horaFormato,
      medico: `${doctor.first_name} ${doctor.last_name}`,
      especialidad: doctor.specialty || especialidad || 'General',
      canal_confirmacion: confirmacion,
      paciente_nombre: paciente_nombre
    });
  } catch (err) {
    console.error('Error en registrar-cita:', err);
    res.status(500).json({
      success: false,
      mensaje: 'Disculpa, algo salió mal al agendar la cita.',
      error: err.message
    });
  }
});

module.exports = router;