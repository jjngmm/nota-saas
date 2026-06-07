import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/register.css';

const SPECIALTIES = [
  'Cardiología',
  'Dermatología',
  'Endocrinología',
  'Gastroenterología',
  'Ginecología y Obstetricia',
  'Medicina General',
  'Medicina Interna',
  'Neurología',
  'Nutrición',
  'Odontología',
  'Oftalmología',
  'Oncología',
  'Ortopedia y Traumatología',
  'Otorrinolaringología',
  'Pediatría',
  'Psicología',
  'Psiquiatría',
  'Radiología',
  'Reumatología',
  'Urología',
  'Otra',
];

const HOW_OPTIONS = [
  'Recomendación de un colega',
  'Redes sociales',
  'Google',
  'Congreso o evento médico',
  'Publicidad',
  'Otro',
];

export default function DoctorRegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    last_name_maternal: '',
    phone: '',
    gender: '',
    specialty: '',
    email: '',
    password: '',
    how_did_you_hear: '',
    accepted_terms: false,
    accepted_data_transfer: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.accepted_terms) {
      setError('Debes aceptar los términos y condiciones para continuar.');
      return;
    }
    // accepted_data_transfer es opcional

    setLoading(true);
    try {
      const res = await api.post('/api/auth/doctor-register', form);
      const { token, user } = res.data;

      // Guardar sesión directamente
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      setSuccess(true);

      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="register-page">
        <RegisterHeader />
        <main className="register-main">
          <div className="register-card">
            <div className="register-success">
              <div className="register-success__icon">✓</div>
              <h2 className="register-success__title">¡Registro exitoso!</h2>
              <p className="register-success__desc">
                Tu cuenta ha sido creada. En un momento te redirigimos a tu panel.
              </p>
              <button className="register-success__btn" onClick={() => navigate('/dashboard')}>
                Ir al panel
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="register-page">
      <RegisterHeader />

      <main className="register-main">
        <div className="register-card">
          <div className="register-card__heading">
            <h1 className="register-card__title">Crea tu cuenta</h1>
            <p className="register-card__sub">
              Empieza a usar Nōta — tu consultorio digital en minutos.
            </p>
          </div>

          <form className="register-form" onSubmit={handleSubmit} noValidate>

            {/* Nombre */}
            <div className="register-row register-row--3">
              <div className="register-field">
                <label className="register-label">Nombre(s) <sup>*</sup></label>
                <input
                  className="register-input"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Ej. María Elena"
                  required
                />
              </div>
              <div className="register-field">
                <label className="register-label">Apellido paterno <sup>*</sup></label>
                <input
                  className="register-input"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Ej. García"
                  required
                />
              </div>
              <div className="register-field">
                <label className="register-label">Apellido materno</label>
                <input
                  className="register-input"
                  name="last_name_maternal"
                  value={form.last_name_maternal}
                  onChange={handleChange}
                  placeholder="Ej. López"
                />
              </div>
            </div>

            {/* Teléfono + Sexo */}
            <div className="register-row">
              <div className="register-field">
                <label className="register-label">Teléfono</label>
                <input
                  className="register-input"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Ej. 81 1234 5678"
                />
              </div>
              <div className="register-field">
                <label className="register-label">Sexo</label>
                <div className="register-select-wrap">
                  <select
                    className="register-select"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option value="">Selecciona...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                    <option value="prefiero_no_decir">Prefiero no decir</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Especialidad */}
            <div className="register-field">
              <label className="register-label">Especialidad <sup>*</sup></label>
              <div className="register-select-wrap">
                <select
                  className="register-select"
                  name="specialty"
                  value={form.specialty}
                  onChange={handleChange}
                  required
                >
                  <option value="">Selecciona tu especialidad...</option>
                  {SPECIALTIES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="register-divider" />

            {/* Email */}
            <div className="register-field">
              <label className="register-label">Correo electrónico <sup>*</sup></label>
              <input
                className="register-input"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Contraseña */}
            <div className="register-field">
              <label className="register-label">Contraseña <sup>*</sup></label>
              <div className="register-password-wrap">
                <input
                  className="register-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Cómo nos conoció */}
            <div className="register-field">
              <label className="register-label">¿Cómo nos conociste?</label>
              <div className="register-select-wrap">
                <select
                  className="register-select"
                  name="how_did_you_hear"
                  value={form.how_did_you_hear}
                  onChange={handleChange}
                >
                  <option value="">Selecciona una opción...</option>
                  {HOW_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="register-divider" />

            {/* Checkboxes */}
            <div className="register-checks">
              <label className="register-check">
                <input
                  type="checkbox"
                  name="accepted_terms"
                  checked={form.accepted_terms}
                  onChange={handleChange}
                />
                <span className="register-check__text">
                  Acepto los <a href="#" onClick={e => e.preventDefault()}>términos y condiciones</a> de uso de Nōta.
                </span>
              </label>
              <label className="register-check">
                <input
                  type="checkbox"
                  name="accepted_data_transfer"
                  checked={form.accepted_data_transfer}
                  onChange={handleChange}
                />
                <span className="register-check__text">
                  Acepto la <a href="#" onClick={e => e.preventDefault()}>transferencia y tratamiento de datos personales</a> conforme a la Ley Federal de Protección de Datos Personales.
                </span>
              </label>
            </div>

            {/* Error */}
            {error && <div className="register-error">{error}</div>}

            {/* Submit */}
            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
}

function RegisterHeader() {
  return (
    <header className="register-header">
      <Link to="/login" className="register-header__brand">
        <div className="register-header__mark"><span>ō</span></div>
        <span className="register-header__name">N<em>ō</em>ta</span>
      </Link>
      <span className="register-header__login">
        ¿Ya tienes cuenta?
        <Link to="/login">Inicia sesión</Link>
      </span>
    </header>
  );
}
