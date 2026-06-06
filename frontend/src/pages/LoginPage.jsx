import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, setError } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', orgId: '' });

  // Org search
  const [orgQuery, setOrgQuery] = useState('');
  const [orgResults, setOrgResults] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null); // { id, name, city }
  const [searchingOrg, setSearchingOrg] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef(null);
  const dropdownRef = useRef(null);

  // Signup state
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // Limpiar error al cambiar campos
  useEffect(() => { setError?.(null); }, [formData, selectedOrg]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Búsqueda de org con debounce
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (!orgQuery || orgQuery.length < 2 || selectedOrg) {
      setOrgResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchingOrg(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/auth/orgs?q=${encodeURIComponent(orgQuery)}`);
        setOrgResults(res.data.data || []);
        setShowDropdown(true);
      } catch {
        setOrgResults([]);
      } finally {
        setSearchingOrg(false);
      }
    }, 350);
    return () => clearTimeout(searchTimeout.current);
  }, [orgQuery, selectedOrg]);

  function handleOrgSelect(org) {
    setSelectedOrg(org);
    setOrgQuery(org.name);
    setShowDropdown(false);
    setOrgResults([]);
  }

  function handleOrgClear() {
    setSelectedOrg(null);
    setOrgQuery('');
    setOrgResults([]);
    setShowDropdown(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    const ok = await login(selectedOrg?.id || formData.orgId || null, formData.email, formData.password);
    if (ok) navigate('/dashboard');
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!selectedOrg) return;
    setSignupLoading(true);
    setSignupError('');
    try {
      await api.post('/api/auth/signup', {
        orgId: selectedOrg.id,
        email: formData.email,
        password: formData.password,
      });
      setSignupSuccess(true);
    } catch (err) {
      setSignupError(err.response?.data?.error || 'Error al crear la cuenta');
    } finally {
      setSignupLoading(false);
    }
  }

  function switchMode(newMode) {
    setMode(newMode);
    setFormData({ email: '', password: '' });
    setSignupSuccess(false);
    setSignupError('');
    setError?.(null);
  }

  // La clínica es opcional — el backend la resuelve por email si es única
  const isFormValid = formData.email && formData.password;

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-brand">
          <h1 className="login-brand__name">Nōta</h1>
          <p className="login-brand__tagline">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crear nueva cuenta'}
          </p>
        </div>

        {signupSuccess ? (
          <div className="login-success">
            <div className="login-success__icon">✓</div>
            <p className="login-success__title">Cuenta creada</p>
            <p className="login-success__desc">Tu cuenta fue creada correctamente. Ahora puedes iniciar sesión.</p>
            <button className="login-btn login-btn--primary" onClick={() => switchMode('login')}>
              Iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="login-form">

            {/* Buscar clínica */}
            <div className="login-field" ref={dropdownRef}>
              <label className="login-label">Clínica</label>
              <div className="login-org-input-wrap">
                <input
                  className={`login-input ${selectedOrg ? 'login-input--selected' : ''}`}
                  type="text"
                  placeholder="Busca tu clínica por nombre..."
                  value={orgQuery}
                  onChange={(e) => {
                    setOrgQuery(e.target.value);
                    if (selectedOrg) setSelectedOrg(null);
                  }}
                  autoComplete="off"
                />
                {searchingOrg && <span className="login-org-spinner" />}
                {selectedOrg && (
                  <button type="button" className="login-org-clear" onClick={handleOrgClear} title="Cambiar clínica">✕</button>
                )}
              </div>
              {selectedOrg && (
                <p className="login-org-confirm">
                  <span className="login-org-check">✓</span> {selectedOrg.name}{selectedOrg.city ? `, ${selectedOrg.city}` : ''}
                </p>
              )}
              {showDropdown && orgResults.length > 0 && (
                <ul className="login-org-dropdown">
                  {orgResults.map((org) => (
                    <li key={org.id} className="login-org-option" onMouseDown={() => handleOrgSelect(org)}>
                      <span className="login-org-option__name">{org.name}</span>
                      {org.city && <span className="login-org-option__city">{org.city}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && orgResults.length === 0 && !searchingOrg && orgQuery.length >= 2 && (
                <ul className="login-org-dropdown">
                  <li className="login-org-empty">No se encontró ninguna clínica</li>
                </ul>
              )}
            </div>

            {/* Fallback UUID — visible si no se seleccionó clínica del dropdown */}
            {!selectedOrg && (
              <div className="login-field">
                <label className="login-label">Código de clínica <span style={{fontWeight:400, textTransform:'none', letterSpacing:0}}>(si no aparece en la búsqueda)</span></label>
                <input
                  className="login-input"
                  type="text"
                  name="orgId"
                  value={formData.orgId}
                  onChange={handleChange}
                  placeholder="UUID de tu organización"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Email */}
            <div className="login-field">
              <label className="login-label">Correo electrónico</label>
              <input
                className="login-input"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Contraseña */}
            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <div className="login-password-wrap">
                <input
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {(error || signupError) && (
              <div className="login-error">{error || signupError}</div>
            )}

            {/* Botón submit */}
            <button
              type="submit"
              className="login-btn login-btn--primary"
              disabled={!isFormValid || isLoading || signupLoading}
            >
              {(isLoading || signupLoading)
                ? 'Cargando...'
                : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>

            {/* Switch mode */}
            <p className="login-switch">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              {' '}
              <button type="button" className="login-switch__link" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
