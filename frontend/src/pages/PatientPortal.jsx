import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function PatientPortal() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-nota-cream">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-light text-nota-ink font-serif">
            Bienvenido, {user?.email}
          </h1>
          <Button variant="secondary" onClick={logout}>
            Cerrar Sesión
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-nota-light">
            <h2 className="text-xl font-medium text-nota-ink mb-4">
              Mis Citas
            </h2>
            <p className="text-nota-mid">
              Próximamente: Ver y agendar citas médicas
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-nota-light">
            <h2 className="text-xl font-medium text-nota-ink mb-4">
              Mis Médicos
            </h2>
            <p className="text-nota-mid">
              Próximamente: Ver lista de médicos disponibles
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-nota-light">
            <h2 className="text-xl font-medium text-nota-ink mb-4">
              Mi Perfil
            </h2>
            <p className="text-nota-mid">
              Próximamente: Editar información personal
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-nota-light">
            <h2 className="text-xl font-medium text-nota-ink mb-4">
              Historial Médico
            </h2>
            <p className="text-nota-mid">
              Próximamente: Ver tus registros médicos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
