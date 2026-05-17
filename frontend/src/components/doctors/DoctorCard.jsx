import Button from "../ui/Button";
import SpecialtyBadge from "../ui/SpecialtyBadge";

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function DoctorCard({ doctor, onViewAvailability, onSchedule }) {
  return (
    <div className="doctor-card">
      <div className="doctor-card-header">
        <div className="doctor-avatar-lg">{getInitials(doctor.full_name)}</div>
        <div>
          <p className="doctor-card-name">{doctor.full_name}</p>
          <SpecialtyBadge specialty={doctor.specialty} />
        </div>
      </div>

      <div className="doctor-card-body">
        {doctor.email && (
          <div className="doctor-info-row">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{doctor.email}</span>
          </div>
        )}
        {doctor.phone && (
          <div className="doctor-info-row">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{doctor.phone}</span>
          </div>
        )}
        {doctor.license_number && (
          <div className="doctor-info-row">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-mono text-sm">Cédula: {doctor.license_number}</span>
          </div>
        )}
      </div>

      <div className="doctor-card-footer">
        <button className="action-link" onClick={() => onViewAvailability(doctor)}>
          Ver horarios
        </button>
        <Button size="sm" onClick={() => onSchedule(doctor)}>
          Agendar cita
        </Button>
      </div>
    </div>
  );
}