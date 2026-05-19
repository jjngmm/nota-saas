import { useState, useEffect } from "react";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function DoctorAvailabilityModal({ doctor, onClose, onSchedule }) {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAvailability();
    // Lock body scroll
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function fetchAvailability() {
    try {
      setLoading(true);
      const res = await api.get(`/api/doctors/${doctor.id}/availability`);
      setAvailability(res.data || []);
    } catch {
      setError("No se pudo cargar la disponibilidad.");
    } finally {
      setLoading(false);
    }
  }

  // Group by day_of_week
  const byDay = DAYS.reduce((acc, day, idx) => {
    const dayNum = idx + 1; // 1=Monday ... 7=Sunday
    acc[day] = availability.filter((a) => a.day_of_week === dayNum);
    return acc;
  }, {});

  const activeDays = DAYS.filter((day) => byDay[day].length > 0);

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Horario disponible</h3>
            <p className="modal-subtitle">{doctor.full_name} · {doctor.specialty}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {loading ? (
            <LoadingSpinner message="Cargando horarios..." />
          ) : error ? (
            <p className="text-error">{error}</p>
          ) : activeDays.length === 0 ? (
            <div className="availability-empty">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" opacity="0.3">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No hay horarios registrados</p>
            </div>
          ) : (
            <div className="availability-grid">
              {activeDays.map((day) => (
                <div key={day} className="availability-day">
                  <p className="availability-day-name">{day}</p>
                  <div className="availability-slots">
                    {byDay[day].map((slot, i) => (
                      <span key={i} className="availability-slot">
                        {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button onClick={() => { onClose(); onSchedule(doctor); }}>
            Agendar cita
          </Button>
        </div>
      </div>
    </div>
  );
}
