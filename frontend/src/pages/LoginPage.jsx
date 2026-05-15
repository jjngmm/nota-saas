import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  
  const [formData, setFormData] = useState({
    orgId: '',
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(formData.orgId, formData.email, formData.password);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-nota-cream flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-nota-light">
        <h1 className="text-3xl font-light text-center mb-8 text-nota-ink font-serif">
          Nōta
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nota-ink mb-1">
              Organization ID
            </label>
            <input
              type="text"
              name="orgId"
              value={formData.orgId}
              onChange={handleChange}
              placeholder="UUID de tu clínica"
              required
              className="w-full px-4 py-2 border border-nota-light rounded-lg focus:outline-none focus:border-nota-forest"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nota-ink mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              required
              className="w-full px-4 py-2 border border-nota-light rounded-lg focus:outline-none focus:border-nota-forest"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nota-ink mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 border border-nota-light rounded-lg focus:outline-none focus:border-nota-forest"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-nota-forest text-nota-cream py-2 rounded-lg font-medium hover:bg-nota-forest-mid disabled:opacity-50"
          >
            {isLoading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}