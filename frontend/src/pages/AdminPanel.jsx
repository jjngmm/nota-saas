import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import api from '../services/api';

export default function AdminPanel() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('doctors');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Debug: mostrar rol actual
  console.log('Current user:', user);
  console.log('Current role:', user?.role);
  console.log('Has token:', !!token);

  // Form states
  const [doctorForm, setDoctorForm] = useState({
    first_name: '',
    last_name: '',
    specialty: '',
    license_number: '',
    phone: '',
    bio: ''
  });

  const [patientForm, setPatientForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    blood_type: '',
    allergies: '',
    medical_history: ''
  });

  // Handle doctor form change
  const handleDoctorChange = (e) => {
    const { name, value } = e.target;
    setDoctorForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle patient form change
  const handlePatientChange = (e) => {
    const { name, value } = e.target;
    setPatientForm(prev => ({ ...prev, [name]: value }));
  };

  // Create doctor
  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/api/doctors', doctorForm);
      setMessage(`✓ Doctor "${response.data.doctor.first_name} ${response.data.doctor.last_name}" creado exitosamente`);
      setDoctorForm({
        first_name: '',
        last_name: '',
        specialty: '',
        license_number: '',
        phone: '',
        bio: ''
      });
    } catch (err) {
      setMessage(`✗ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create patient
  const handleCreatePatient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/api/patients', patientForm);
      setMessage(`✓ Paciente "${response.data.patient.first_name} ${response.data.patient.last_name}" creado exitosamente`);
      setPatientForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        birth_date: '',
        blood_type: '',
        allergies: '',
        medical_history: ''
      });
    } catch (err) {
      setMessage(`✗ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check role - show message if not authorized
  if (!user || (user?.role !== 'secretary' && user?.role !== 'admin')) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-light text-nota-ink mb-4 font-serif">
          Acceso Denegado
        </h1>
        <p className="text-nota-mid mb-4">No tienes permisos para acceder a este panel.</p>
        <p className="text-sm text-nota-light">Tu rol actual: <strong>{user?.role || 'desconocido'}</strong></p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-light text-nota-ink mb-2 font-serif">
        Panel de Administración
      </h1>
      <p className="text-nota-mid mb-8">Rol: <strong>{user?.role}</strong></p>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-nota-light mb-8">
        <button
          onClick={() => setActiveTab('doctors')}
          className={`pb-2 px-4 font-medium ${
            activeTab === 'doctors'
              ? 'text-nota-forest border-b-2 border-nota-forest'
              : 'text-nota-mid'
          }`}
        >
          Crear Doctor
        </button>
        <button
          onClick={() => setActiveTab('patients')}
          className={`pb-2 px-4 font-medium ${
            activeTab === 'patients'
              ? 'text-nota-forest border-b-2 border-nota-forest'
              : 'text-nota-mid'
          }`}
        >
          Crear Paciente
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.startsWith('✓')
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Doctor Form */}
      {activeTab === 'doctors' && (
        <form onSubmit={handleCreateDoctor} className="bg-white p-6 rounded-lg border border-nota-light space-y-4">
          <h2 className="text-xl font-medium text-nota-ink mb-4">Nuevo Doctor</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre"
              name="first_name"
              value={doctorForm.first_name}
              onChange={handleDoctorChange}
              required
            />
            <Input
              label="Apellido"
              name="last_name"
              value={doctorForm.last_name}
              onChange={handleDoctorChange}
              required
            />
          </div>

          <Input
            label="Especialidad"
            name="specialty"
            value={doctorForm.specialty}
            onChange={handleDoctorChange}
            placeholder="Ej: Cardiología"
            required
          />

          <Input
            label="Cédula Profesional"
            name="license_number"
            value={doctorForm.license_number}
            onChange={handleDoctorChange}
            required
          />

          <Input
            label="Teléfono"
            name="phone"
            value={doctorForm.phone}
            onChange={handleDoctorChange}
            type="tel"
          />

          <div>
            <label className="block text-sm font-medium text-nota-ink mb-1">
              Biografía
            </label>
            <textarea
              name="bio"
              value={doctorForm.bio}
              onChange={handleDoctorChange}
              placeholder="Breve descripción del doctor"
              className="w-full px-4 py-2 border border-nota-light rounded-lg focus:outline-none focus:border-nota-forest"
              rows="4"
            />
          </div>

          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Doctor'}
          </Button>
        </form>
      )}

      {/* Patient Form */}
      {activeTab === 'patients' && (
        <form onSubmit={handleCreatePatient} className="bg-white p-6 rounded-lg border border-nota-light space-y-4">
          <h2 className="text-xl font-medium text-nota-ink mb-4">Nuevo Paciente</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre"
              name="first_name"
              value={patientForm.first_name}
              onChange={handlePatientChange}
              required
            />
            <Input
              label="Apellido"
              name="last_name"
              value={patientForm.last_name}
              onChange={handlePatientChange}
              required
            />
          </div>

          <Input
            label="Email"
            name="email"
            type="email"
            value={patientForm.email}
            onChange={handlePatientChange}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Teléfono"
              name="phone"
              type="tel"
              value={patientForm.phone}
              onChange={handlePatientChange}
            />
            <Input
              label="Fecha de Nacimiento"
              name="birth_date"
              type="date"
              value={patientForm.birth_date}
              onChange={handlePatientChange}
            />
          </div>

          <Input
            label="Tipo de Sangre"
            name="blood_type"
            value={patientForm.blood_type}
            onChange={handlePatientChange}
            placeholder="O+, A-, etc."
          />

          <div>
            <label className="block text-sm font-medium text-nota-ink mb-1">
              Alergias
            </label>
            <textarea
              name="allergies"
              value={patientForm.allergies}
              onChange={handlePatientChange}
              placeholder="Lista de alergias conocidas"
              className="w-full px-4 py-2 border border-nota-light rounded-lg focus:outline-none focus:border-nota-forest"
              rows="2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nota-ink mb-1">
              Antecedentes Médicos
            </label>
            <textarea
              name="medical_history"
              value={patientForm.medical_history}
              onChange={handlePatientChange}
              placeholder="Historial médico relevante"
              className="w-full px-4 py-2 border border-nota-light rounded-lg focus:outline-none focus:border-nota-forest"
              rows="3"
            />
          </div>

          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Paciente'}
          </Button>
        </form>
      )}
    </div>
  );
}
