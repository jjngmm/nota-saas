// ════════════════════════════════════════════════════════════
// Control de acceso de médicos a pacientes
//
// Regla: un médico (role='doctor') solo puede ver el expediente de
// un paciente si tiene una cita agendada con él, o si él mismo creó
// al paciente. Los administradores y secretarias no se restringen
// aquí (admin ve todo; la secretaria está limitada al directorio y
// no entra al expediente desde la UI).
// ════════════════════════════════════════════════════════════

async function getDoctorId(supabase, userId, orgId) {
  const { data } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single();
  return data?.id || null;
}

// Devuelve la lista de IDs de pacientes que un médico puede ver,
// o null si el usuario tiene acceso total (admin / secretaria).
async function accessiblePatientIds(supabase, user) {
  if (user.role !== 'doctor') return null; // acceso total

  const doctorId = await getDoctorId(supabase, user.userId, user.orgId);
  if (!doctorId) return []; // médico sin perfil → sin pacientes

  const [appts, created] = await Promise.all([
    supabase.from('appointments').select('patient_id')
      .eq('org_id', user.orgId).eq('doctor_id', doctorId),
    supabase.from('patients').select('id')
      .eq('org_id', user.orgId).eq('created_by', user.userId),
  ]);

  const ids = new Set();
  (appts.data || []).forEach(a => a.patient_id && ids.add(a.patient_id));
  (created.data || []).forEach(p => ids.add(p.id));
  return [...ids];
}

// ¿Puede el usuario acceder al expediente de un paciente concreto?
async function canAccessPatient(supabase, user, patientId) {
  if (user.role !== 'doctor') return true; // admin / secretaria

  const doctorId = await getDoctorId(supabase, user.userId, user.orgId);
  if (!doctorId) return false;

  const [appt, created] = await Promise.all([
    supabase.from('appointments').select('id')
      .eq('org_id', user.orgId).eq('doctor_id', doctorId).eq('patient_id', patientId).limit(1),
    supabase.from('patients').select('id')
      .eq('id', patientId).eq('org_id', user.orgId).eq('created_by', user.userId).limit(1),
  ]);

  return !!((appt.data && appt.data.length) || (created.data && created.data.length));
}

// Middleware Express: bloquea el acceso al expediente si el médico
// no tiene relación con el paciente (req.params.id = patient_id).
function requirePatientAccess(req, res, next) {
  canAccessPatient(req.supabase, req.user, req.params.id)
    .then(ok => {
      if (!ok) {
        return res.status(403).json({ error: 'No tienes acceso al expediente de este paciente' });
      }
      next();
    })
    .catch(err => res.status(500).json({ error: err.message }));
}

module.exports = { getDoctorId, accessiblePatientIds, canAccessPatient, requirePatientAccess };
