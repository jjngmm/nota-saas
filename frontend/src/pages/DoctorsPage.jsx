import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";
import DoctorCard from "../components/doctors/DoctorCard";
import DoctorTable from "../components/doctors/DoctorTable";
import DoctorAvailabilityModal from "../components/doctors/DoctorAvailabilityModal";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" | "cards"
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDoctors();
  }, []);

  async function fetchDoctors() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/doctors");
      setDoctors(res.data || []);
    } catch (err) {
      setError("No se pudieron cargar los médicos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleViewAvailability(doctor) {
    setSelectedDoctor(doctor);
    setShowAvailability(true);
  }

  function handleScheduleAppointment(doctor) {
    navigate("/appointments/new", { state: { doctorId: doctor.id } });
  }

  const filtered = doctors.filter((d) => {
    const term = search.toLowerCase();
    return (
      d.full_name?.toLowerCase().includes(term) ||
      d.specialty?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar title="Médicos" />

        <div className="nota-content">
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Directorio Médico</h1>
              <p className="page-subtitle">
                {doctors.length} médico{doctors.length !== 1 ? "s" : ""} registrado
                {doctors.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="toolbar-left">
              <Input
                placeholder="Buscar por nombre, especialidad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <div className="toolbar-right">
              <div className="view-toggle">
                <button
                  className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Vista tabla"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
                  onClick={() => setViewMode("cards")}
                  title="Vista tarjetas"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <LoadingSpinner message="Cargando médicos..." />
          ) : error ? (
            <EmptyState
              icon="error"
              title="Error al cargar"
              description={error}
              action={<Button onClick={fetchDoctors}>Reintentar</Button>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="empty"
              title={search ? "Sin resultados" : "Sin médicos"}
              description={
                search
                  ? `No hay médicos que coincidan con "${search}"`
                  : "No hay médicos registrados aún."
              }
            />
          ) : viewMode === "table" ? (
            <DoctorTable
              doctors={filtered}
              onViewAvailability={handleViewAvailability}
              onSchedule={handleScheduleAppointment}
            />
          ) : (
            <div className="cards-grid">
              {filtered.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  onViewAvailability={handleViewAvailability}
                  onSchedule={handleScheduleAppointment}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAvailability && selectedDoctor && (
        <DoctorAvailabilityModal
          doctor={selectedDoctor}
          onClose={() => {
            setShowAvailability(false);
            setSelectedDoctor(null);
          }}
          onSchedule={handleScheduleAppointment}
        />
      )}
    </div>
  );
}
