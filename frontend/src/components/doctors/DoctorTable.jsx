import Button from "../../components/ui/Button";
import SpecialtyBadge from "../../components/ui/SpecialtyBadge";

export default function DoctorTable({ doctors, onViewAvailability, onSchedule }) {
  return (
    <div className="table-wrapper">
      <table className="nota-table">
        <thead>
          <tr>
            <th>Médico</th>
            <th>Especialidad</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Cédula</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {doctors.map((doctor) => (
            <tr key={doctor.id}>
              <td>
                <div className="doctor-cell">
                  <div className="doctor-avatar-sm">
                    {getInitials(doctor.full_name)}
                  </div>
                  <span className="doctor-name">{doctor.full_name}</span>
                </div>
              </td>
              <td>
                <SpecialtyBadge specialty={doctor.specialty} />
              </td>
              <td className="text-muted">{doctor.email || "—"}</td>
              <td className="text-muted">{doctor.phone || "—"}</td>
              <td className="text-muted font-mono text-sm">{doctor.license_number || "—"}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="action-link"
                    onClick={() => onViewAvailability(doctor)}
                  >
                    Ver horarios
                  </button>
                  <Button size="sm" onClick={() => onSchedule(doctor)}>
                    Agendar cita
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getInitials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
