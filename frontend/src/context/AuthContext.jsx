import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

// Decodifica el payload del JWT sin verificar firma (solo para leer expiración localmente)
function decodeTokenPayload(token) {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  // Considera expirado si quedan menos de 60 segundos
  return payload.exp * 1000 < Date.now() + 60_000;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verifica el token contra el servidor (solo si no está expirado localmente)
  const verifyToken = useCallback(async (currentToken) => {
    if (!currentToken || isTokenExpired(currentToken)) {
      clearSession();
      return;
    }
    try {
      const res = await api.get('/api/auth/verify');
      const userData = res.data.user;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch {
      clearSession();
    }
  }, []);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, []); // Solo al montar — el token no cambia durante la sesión

  function clearSession() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  const login = useCallback(async (orgId, email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const body = { email, password };
      if (orgId) body.orgId = orgId;
      const res = await api.post('/api/auth/login', body);
      const { token: newToken, user: userData } = res.data;
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, error, setError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
