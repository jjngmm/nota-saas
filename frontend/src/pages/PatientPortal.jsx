import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import api from '../services/api';

export default function PatientPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('search');
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [appointmentForm, setAppointmentForm] = useState({
    doctor_id: '',
    appointment_date: '',
    start_time: '',
    reason: ''
  });

  // Cargar médicos
  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/api/doctors');
      setDoctors(response.data.doctors || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/api/appointments');
      setAppointments(response.data.appointments || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  };

  const handleAppointmentChange = (e) => {
    const { name, value } = e.target;
    setAppointmentForm(prev => ({ ...prev, [name]: value }));
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!appointmentForm.doctor_id || !appointmentForm.appointment_date || !appointmentForm.start_time) {
      setMessage('✗ Por favor completa todos los campos requeridos');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/api/appointments', {
        doctor_id: appointmentForm.doctor_id,
        appointment_date: appointmentForm.appointment_date,
        start_time: appointmentForm.start_time,
        reason: appointmentForm.reason || 'Consulta general',
        duration_minutes: 30
      });

      setMessage('✓ Cita agendada exitosamente');
      setAppointmentForm({
        doctor_id: '',
        appointment_date: '',
        start_time: '',
        reason: ''
      });
      setSelectedDoctor(null);
      setTimeout(() => {
        fetchAppointments();
        setActiveTab('appointments');
      }, 1500);
    } catch (err) {
      setMessage(`✗ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(doc =>
    doc.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-nota-cream">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-light text-nota-ink font-serif mb-1">
              Portal del Paciente
            </h1>
            <p className="text-nota-mid text-sm">
              Bienvenido, {user?.email}
            </p>
          </div>
          <Button variant="secondary" onClick={logout}>
            Cerrar Sesión
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-nota-light mb-8">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2 px-4 font-medium ${
              activeTab === 'search'
                ? 'text-nota-forest border-b-2 border-nota-forest'
                : 'text-nota-mid'
            }`}
          >
            Buscar Médicos
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`pb-2 px-4 font-medium ${
              activeTab === 'appointments'
                ? 'text-nota-forest border-b-2 border-nota-forest'
                : 'text-nota-mid'
            }`}
          >
            Mis Citas ({appointments.length})
          </button>
        </div>

        {/* Search Doctors Tab */}
        {activeTab === 'search' && (
          <div className="grid grid-cols-3 gap-8">
            {/* Doctor List */}
            <div className="col-span-2">
              <div className="mb-6">
                <Input
                  label="Buscar médico por nombre o especialidad"
                  name="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ej: Cardiología, Dr. Vega"
                />
              </div>

              <div className="space-y-4">
                {filteredDoctors.length > 0 ? (
                  filteredDoctors.map(doctor => (
                    <div
                      key={doctor.id}
                      onClick={() => setSelectedDoctor(doctor)}
                      className={`p-6 rounded-lg border cursor-pointer transition ${
                        selectedDoctor?.id === doctor.id
                          ? 'bg-nota-green-soft border-nota-forest'
                          : 'bg-white border-nota-light hover:border-nota-forest'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium text-nota-ink">
                            Dr. {doctor.first_name} {doctor.last_name}
                          </h3>
                          <p className="text-nota-mid text-sm mt-1">
                            {doctor.specialty}
                          </p>
                          {doctor.bio && (
                            <p className="text-nota-mid text-sm mt-2">
                              {doctor.bio}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          doctor.active
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}>
                          {doctor.active ? 'Disponible' : 'No disponible'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-nota-mid">
                      No se encontraron médicos
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Appointment Form */}
            <div>
              {selectedDoctor ? (
                <div className="bg-white p-6 rounded-lg border border-nota-light sticky top-8">
                  <h3 className="text-lg font-medium text-nota-ink mb-4">
                    Agendar Cita
                  </h3>

                  {message && (
                    <div className={`p-3 rounded-lg mb-4 text-sm ${
                      message.startsWith('✓')
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      {message}
                    </div>
                  )}

                  <form onSubmit={handleBookAppointment} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-nota-ink mb-1">
                        Médico
                      </label>
                      <p className="text-nota-mid text-sm">
                        Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}
                      </p>
                    </div>

                    <Input
                      label="Fecha"
                      type="date"
                      name="appointment_date"
                      value={appointmentForm.appointment_date}
                      onChange={handleAppointmentChange}
                      required
                    />

                    <Input
                      label="Hora"
                      type="time"
                      name="start_time"
                      value={appointmentForm.start_time}
                      onChange={handleAppointmentChange}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-nota-ink mb-1">
                        Motivo de la consulta
                      </label>
                      <textarea
                        name="reason"
                        value={appointmentForm.reason}
                        onChange={handleAppointmentChange}
                        placeholder="Describe tu motivo de consulta"
                        className="w-full px-4 py-2 border border-nota-light rounded-lg focus:outline-none focus:border-nota-forest text-sm"
                        rows="3"
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Agendando...' : 'Agendar Cita'}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedDoctor(null)}
                      className="w-full"
                    >
                      Cancelar
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="bg-white p-6 rounded-lg border border-nota-light text-center sticky top-8">
                  <p className="text-nota-mid text-sm">
                    Selecciona un médico para agendar una cita
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div>
            {appointments.length > 0 ? (
              <div className="space-y-4">
                {appointments.map(apt => (
                  <div key={apt.id} className="bg-white p-6 rounded-lg border border-nota-light">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium text-nota-ink">
                          Cita agendada
                        </h3>
                        <p className="text-nota-mid text-sm mt-2">
                          Fecha: {new Date(apt.scheduled_at).toLocaleDateString('es-MX')}
                        </p>
                        <p className="text-nota-mid text-sm">
                          Hora: {apt.scheduled_at.split('T')[1].substring(0, 5)}
                        </p>
                        {apt.reason && (
                          <p className="text-nota-mid text-sm mt-2">
                            Motivo: {apt.reason}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        apt.status === 'scheduled'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-50 text-gray-700 border border-gray-200'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-nota-light">
                <p className="text-nota-mid">
                  No tienes citas agendadas aún
                </p>
                <Button
                  onClick={() => setActiveTab('search')}
                  className="mt-4"
                >
                  Agendar primera cita
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
