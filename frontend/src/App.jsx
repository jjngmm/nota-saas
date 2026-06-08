import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import PatientRegister from "./pages/PatientRegister";
import DashboardPage from "./pages/DashboardPage";
import DoctorsPage from "./pages/DoctorsPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import PatientsPage from "./pages/PatientsPage";
import PatientPortal from './pages/PatientPortal';
import AdminPanel from "./pages/AdminPanel";
import ClinicalNotePage from "./pages/ClinicalNotePage";
import DoctorRegisterPage from "./pages/DoctorRegisterPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import AyudaPage from "./pages/AyudaPage";
import PlanesPage from "./pages/PlanesPage";
import EstadisticasPage from "./pages/EstadisticasPage";
import FormulariosPage from "./pages/FormulariosPage";
import FormularioPublico from "./pages/FormularioPublico";
import AgendaPage from "./pages/AgendaPage";
import PatientPage from "./pages/PatientPage";
import "./styles/nota.css";
import "./styles/patient_page.css";
import "./styles/agenda.css";
import "./styles/appointments.css";
import "./styles/patients.css";
import "./styles/dashboard.css";
import "./styles/clinical_notes.css";
import "./styles/register.css";
import "./styles/configuracion.css";
import "./styles/ayuda.css";
import "./styles/planes.css";
import "./styles/estadisticas.css";
import "./styles/forms.css";

function ProtectedRoute({ children, roles }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<DoctorRegisterPage />} />
          <Route path="/register-patient" element={<PatientRegister />} />
          <Route path="/patient-portal" element={<ProtectedRoute><PatientPortal /></ProtectedRoute>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/doctors"
            element={<ProtectedRoute roles={["admin"]}><DoctorsPage /></ProtectedRoute>}
          />
          <Route path="/appointments"
            element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>}
          />
          <Route path="/patients"
            element={<ProtectedRoute><PatientsPage /></ProtectedRoute>}
          />
          <Route path="/patients/:id"
            element={<ProtectedRoute><PatientPage /></ProtectedRoute>}
          />
          <Route path="/admin"
            element={<ProtectedRoute roles={["admin"]}><AdminPanel /></ProtectedRoute>}
          />
          <Route path="/configuracion"
            element={<ProtectedRoute roles={["admin","doctor"]}><ConfiguracionPage /></ProtectedRoute>}
          />
          <Route path="/ayuda"
            element={<ProtectedRoute><AyudaPage /></ProtectedRoute>}
          />
          <Route path="/planes"
            element={<ProtectedRoute roles={["admin"]}><PlanesPage /></ProtectedRoute>}
          />
          <Route path="/estadisticas"
            element={<ProtectedRoute><EstadisticasPage /></ProtectedRoute>}
          />
          <Route path="/formularios"
            element={<ProtectedRoute roles={["admin","doctor"]}><FormulariosPage /></ProtectedRoute>}
          />
          {/* Ruta pública — no requiere autenticación */}
          <Route path="/f/:token" element={<FormularioPublico />} />
          <Route
            path="/agenda"
            element={<ProtectedRoute><AgendaPage /></ProtectedRoute>}
          />
          <Route
            path="/clinical-notes/:appointment_id"
            element={
              <ProtectedRoute>
                <ClinicalNotePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
