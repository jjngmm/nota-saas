import { useState, useEffect } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Programada" },
  { value: "confirmed", label: "Confirmada" },
  { value: "completed", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No se presentó" },
];

const EMPTY_FORM = {
  patient_id: "",
  doctor_id: "",
  appointment_date: "",
  start_time: "",
  end_time: "",
  reason: "",
  notes: "",
  status: "scheduled",
};

export default function AppointmentForm({
  appointment,
  doctors,
  preselectedDoctorId,
  onSuccess,
  onClose,
}) {
  const { user } = useAuth();
  const isEditing = !!appointment;
  const isSecretary = user?.role === "secretary" || user?.role === "admin";

  const [form, setForm] = useState(EMPTY_FORM);
  const [patients, setPatients] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    if (isSecretary) fetchPatients();

    if (isEditing) {
      setForm({
        patient_id: appointment.patient_id || "",
        doctor_id: appointment.doctor_id || "",
        appointment_date: appointment.appointment_date || "",
        start_time: appointment.start_time || "",
        end_time: appointment.end_time || "",
        reason: appointment.reason || "",
        notes: appointment.notes || "",
        status: appointment.status || "scheduled",
      });
    } else if (preselectedDoctorId) {
      setForm((prev) => ({ ...prev, doctor_id: preselectedDoctorId }));
    }

    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function fetchPatients() {
    try {
      const res = await api.get("/api/patients");
      setPatients(res.data || []);
    } catch {
      // Non-critical, continue
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  }

  function validate() {
    const errs = {};
    if (!form.patient_id) errs.patient_id = "Selecciona un paciente";
    if (!form.doctor_id) errs.doctor_id = "Selecciona un médico";
    if (!form.appointment_date) errs.appointment_date = "Ingresa la fecha";
    if (!form.start_time) errs.start_time = "Ingresa la hora de inicio";
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    setApiError(null);

    try {
      let res;
      if (isEditing) {
        res = await api.patch(`/api/appointments/${appointment.id}`, form);
      } else {
        res = await api.post("/api/appointments", form);
      }
      onSuccess(res.data);
    } catch (err) {
      setApiError(err.response?.data?.message || "Error al guardar la cita.");
    } finally {
      setSaving(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const patientOptions = [
    { value: "", label: "Seleccionar paciente..." },
    ...patients.map((p) => ({ value: p.id, label: p.full_name })),
  ];

  const doctorOptions = [
    { value: "", label: "Seleccionar médico..." },
    ...doctors.map((d) => ({ value: d.id, label: `${d.full_name} — ${d.specialty || ""}` })),
  ];

  // Doctors can only edit notes/status, not the core fields
  const readOnly = !isSecretary;

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal modal--lg">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {isEditing ? "Editar cita" : "Nueva cita"}
            </h3>
            <p className="modal-subtitle">
              {isEditing
                ? "Modifica los datos de la cita"
                : "Completa los campos para agendar"}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {apiError && (
            <div className="form-error-banner">{apiError}</div>
          )}

          <div className="form-grid">
            {/* Patient */}
            {isSecretary ? (
              <div className="form-field form-field--full">
                <Select
                  label="Paciente"
                  name="patient_id"
                  value={form.patient_id}
                  onChange={handleChange}
                  options={patientOptions}
                  required
                  error={errors.patient_id}
                  disabled={readOnly}
                />
              </div>
            ) : (
              <div className="form-field form-field--full">
                <label className="input-label">Paciente</label>
                <p className="form-readonly">{appointment?.patient_name || "—"}</p>
              </div>
            )}

            {/* Doctor */}
            <div className="form-field form-field--full">
              <Select
                label="Médico"
                name="doctor_id"
                value={form.doctor_id}
                onChange={handleChange}
                options={doctorOptions}
                required
                error={errors.doctor_id}
                disabled={readOnly}
              />
            </div>

            {/* Date */}
            <div className="form-field">
              <Input
                label="Fecha"
                type="date"
                name="appointment_date"
                value={form.appointment_date}
                onChange={handleChange}
                required
                error={errors.appointment_date}
                disabled={readOnly}
              />
            </div>

            {/* Start time */}
            <div className="form-field">
              <Input
                label="Hora inicio"
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
                error={errors.start_time}
                disabled={readOnly}
              />
            </div>

            {/* End time */}
            <div className="form-field">
              <Input
                label="Hora fin"
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>

            {/* Status */}
            <div className="form-field">
              <Select
                label="Estado"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={STATUS_OPTIONS}
              />
            </div>

            {/* Reason */}
            <div className="form-field form-field--full">
              <label className="input-label">Motivo de consulta</label>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                placeholder="Describe el motivo de la cita..."
                rows={2}
                className="textarea-el"
                disabled={readOnly}
              />
            </div>

            {/* Notes */}
            <div className="form-field form-field--full">
              <label className="input-label">Notas clínicas</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Observaciones adicionales..."
                rows={3}
                className="textarea-el"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Agendar cita"}
          </Button>
        </div>
      </div>
    </div>
  );
}