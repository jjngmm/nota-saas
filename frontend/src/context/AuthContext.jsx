import React, { createContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verificar si token es válido al cargar
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const userData = {
        userId: response.data.user.id,
        email: response.data.user.email,
        orgId: response.data.user.orgId,
        role: response.data.user.role
      };
      
      setUser(userData);
    } catch (err) {
      setToken(null);
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const login = useCallback(async (orgId, email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        { orgId, email, password }
      );
      
      // La respuesta tiene: { message, user, token }
      const { token: newToken, user: newUser } = response.data;
      
      // Extractar datos del usuario
      const userData = {
        userId: newUser.id,
        email: newUser.email,
        orgId: newUser.orgId,
        role: newUser.role
      };
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const value = {
    user,
    token,
    isLoading,
    error,
    login,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};