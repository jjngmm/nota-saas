import { useState, useEffect } from 'react';
import api from '../../services/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

const AppointmentForm = ({ 
  isEditing = false, 
  appointment = null, 
  isSecretary = false,
  preselectedDoctorId = null,
  onSubmit, 
  onClose 
}) => {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    patient_id: '',
    doctor_id: preselectedDoctorId || '',
    appointment_date: '',
    start_time: '',
    end_time: '',
    reason: '',
    notes: ''
  });

  async function fetchPatients() {
    try {
      const res = await api.get("/api/patients");
      setPatients(res.data || []);
    } catch {
      // Non-critical
    }
  }

  async function fetchDoctors() {
    try {
      const res = await api.get("/api/doctors");
      setDoctors(res.data || []);
    } catch {
      // Non-critical
    }
  }

  useEffect(() => {
    fetchDoctors();
    if (isSecretary) fetchPatients();
    if (isEditing && appointment) {
      setForm({
        patient_id: appointment.patient_id || "",
        doctor_id: appointment.doctor_id || "",
        appointment_date: appointment.appointment_date || "",
        start_time: appointment.start_time || "",
        end_time: appointment.end_time || "",
        reason: appointment.reason || "",
        notes: appointment.notes || ""
      });
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isEditing, appointment, isSecretary, preselectedDoctorId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-screen overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? "Editar cita" : "Nueva cita"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSecretary && (
            <Select
              label="Paciente"
              name="patient_id"
              value={form.patient_id}
              onChange={handleChange}
              options={patients.map(p => ({ value: p.id, label: p.full_name }))}
              required
            />
          )}
          
          <Select
            label="Doctor"
            name="doctor_id"
            value={form.doctor_id}
            onChange={handleChange}
            options={doctors.map(d => ({ value: d.id, label: d.full_name }))}
            required
          />

          <Input
            label="Fecha"
            type="date"
            name="appointment_date"
            value={form.appointment_date}
            onChange={handleChange}
            required
          />

          <Input
            label="Hora inicio"
            type="time"
            name="start_time"
            value={form.start_time}
            onChange={handleChange}
            required
          />

          <Input
            label="Hora fin"
            type="time"
            name="end_time"
            value={form.end_time}
            onChange={handleChange}
            required
          />

          <Input
            label="Motivo"
            name="reason"
            value={form.reason}
            onChange={handleChange}
            placeholder="Motivo de la consulta"
          />

          <Input
            label="Notas"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Notas adicionales"
          />

          <div className="flex gap-2 mt-6">
            <Button type="submit" variant="primary">
              {isEditing ? "Guardar cambios" : "Crear cita"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentForm;