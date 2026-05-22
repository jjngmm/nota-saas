import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import api from '../services/api';

export default function PatientRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get('clinic');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: ''
  });

  useEffect(() => {
    if (!orgId) {
      setMessage('✗ Link de registro inválido. Contacta a tu clínica.');
    }
  }, [orgId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!orgId) {
      setMessage('✗ Clínica no identificada');
      setLoading(false);
      return;
    }

    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      setMessage('✗ Todos los campos son requeridos');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage('✗ Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setMessage('✗ La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/api/auth/signup', {
        orgId: orgId,
        email: formData.email,
        password: formData.password
      });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setMessage('✓ Cuenta creada exitosamente. Redirigiendo...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (err) {
      setMessage(`✗ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!orgId) {
    return (
      <div className="min-h-screen bg-nota-cream flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-nota-light">
          <h1 className="text-3xl font-light text-center mb-2 text-nota-ink font-serif">
            Nōta
          </h1>
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            ✗ Link de registro inválido
          </div>
          <p className="text-center text-nota-mid text-sm mt-4">
            Contacta a tu clínica para obtener el link de registro correcto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nota-cream flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-nota-light">
        <h1 className="text-3xl font-light text-center mb-2 text-nota-ink font-serif">
          Nōta
        </h1>
        <p className="text-center text-nota-mid text-sm mb-8">
          Crear Cuenta de Paciente
        </p>

        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm ${
            message.startsWith('✓')
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nombre"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              placeholder="Tu nombre"
              required
            />
            <Input
              label="Apellido"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              placeholder="Tu apellido"
              required
            />
          </div>

          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="tu@email.com"
            required
          />

          <Input
            label="Contraseña"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />

          <Input
            label="Confirmar Contraseña"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />

          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-nota-mid text-sm mb-2">
            ¿Ya tienes cuenta?
          </p>
          <button
            onClick={() => navigate('/login')}
            className="text-nota-forest hover:underline text-sm font-medium"
          >
            Inicia sesión aquí
          </button>
        </div>
      </div>
    </div>
  );
}
