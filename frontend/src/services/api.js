import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: agregar token a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Doctors
export const doctorsAPI = {
  list: () => api.get('/api/doctors'),
  get: (id) => api.get(`/api/doctors/${id}`),
  availability: (id, date) => api.get(`/api/doctors/${id}/availability?date=${date}`),
};

// Patients
export const patientsAPI = {
  list: () => api.get('/api/patients'),
  get: (id) => api.get(`/api/patients/${id}`),
  create: (data) => api.post('/api/patients', data),
  update: (id, data) => api.patch(`/api/patients/${id}`, data),
};

// Appointments
export const appointmentsAPI = {
  list: () => api.get('/api/appointments'),
  get: (id) => api.get(`/api/appointments/${id}`),
  create: (data) => api.post('/api/appointments', data),
  update: (id, data) => api.patch(`/api/appointments/${id}`, data),
  delete: (id) => api.delete(`/api/appointments/${id}`),
};

export default api;