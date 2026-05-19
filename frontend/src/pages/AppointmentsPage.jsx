import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";
import AppointmentTable from "../components/appointments/AppointmentTable";
import AppointmentForm from "../components/appointments/AppointmentForm";
import AppointmentDetailModal from "../components/appointments/AppointmentDetailModal";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "scheduled", label: "Programada" },
  { value: "confirmed", label: "Confirmada" },
  { value: "completed", label: "Completada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No se presentó" },
];

export default function AppointmentsPage() {
  const { user } = useAuth();
  const location = useLocation();

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [detailAppointment, setDetailAppointment] = useState(null);

  // Pre-fill doctor from navigate state (coming from DoctorsPage)
  const preselectedDoctorId = location.state?.doctorId || null;

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (preselectedDoctorId) {
      setShowForm(true);
    }
  }, [preselectedDoctorId]);

  async function fetchAll() {
    try {
      setLoading(true);
      setError(null);
      const [apptRes, docRes] = await Promise.all([
        api.get("/api/appointments"),
        api.get("/api/doctors"),
      ]);
      setAppointments(apptRes.data || []);
      setDoctors(docRes.data || []);
    } catch {
      setError("No se pudieron cargar las citas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Cancelar esta cita?")) return;
    try {
      await api.delete(`/api/appointments/${id}`);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Error al cancelar la cita.");
    }
  }

  function handleEdit(appointment) {
    setEditingAppointment(appointment);
    setShowForm(true);
  }

  function handleDetail(appointment) {
    setDetailAppointment(appointment);
  }

  function handleFormSuccess(saved) {
    if (editingAppointment) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === saved.id ? saved : a))
      );
    } else {
      setAppointments((prev) => [saved, ...prev]);
    }
    setShowForm(false);
    setEditingAppointment(null);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingAppointment(null);
  }

  // Filtering logic
  const filtered = appointments.filter((a) => {
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      a.patient_name?.toLowerCase().includes(term) ||
      a.doctor_name?.toLowerCase().includes(term) ||
      a.notes?.toLowerCase().includes(term);

    const matchStatus = !filterStatus || a.status === filterStatus;
    const matchDoctor = !filterDoctor || a.doctor_id === filterDoctor;
    const matchDate = !filterDate || a.appointment_date?.startsWith(filterDate);

    return matchSearch && matchStatus && matchDoctor && matchDate;
  });

  // Stats
  const stats = {
    total: appointments.length,
    scheduled: appointments.filter((a) => a.status === "scheduled").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  };

  const doctorOptions = [
    { value: "", label: "Todos los médicos" },
    ...doctors.map((d) => ({ value: d.id, label: d.full_name })),
  ];

  const isSecretary = user?.role === "secretary" || user?.role === "admin";

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar
          title="Citas"
          actions={
            isSecretary && (
              <Button onClick={() => setShowForm(true)}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva cita
              </Button>
            )
          }
        />

        <div className="nota-content">
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Gestión de Citas</h1>
              <p className="page-subtitle">
                {filtered.length} cita{filtered.length !== 1 ? "s" : ""}
                {filtered.length !== appointments.length && ` de ${appointments.length}`}
              </p>
            </div>
          </div>

          {/* Stats */}
          {!loading && !error && (
            <div className="stats-row">
              <StatCard label="Total" value={stats.total} color="neutral" />
              <StatCard label="Programadas" value={stats.scheduled} color="blue" />
              <StatCard label="Completadas" value={stats.completed} color="green" />
              <StatCard label="Canceladas" value={stats.cancelled} color="red" />
            </div>
          )}

          {/* Filters */}
          <div className="filters-bar">
            <Input
              placeholder="Buscar paciente, médico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={STATUS_OPTIONS}
            />
            <Select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              options={doctorOptions}
            />
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            {(search || filterStatus || filterDoctor || filterDate) && (
              <button
                className="action-link"
                onClick={() => {
                  setSearch("");
                  setFilterStatus("");
                  setFilterDoctor("");
                  setFilterDate("");
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <LoadingSpinner message="Cargando citas..." />
          ) : error ? (
            <EmptyState
              icon="error"
              title="Error al cargar"
              description={error}
              action={<Button onClick={fetchAll}>Reintentar</Button>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="empty"
              title="Sin citas"
              description={
                search || filterStatus || filterDoctor || filterDate
                  ? "No hay citas que coincidan con los filtros."
                  : "No hay citas registradas aún."
              }
              action={
                isSecretary && (
                  <Button onClick={() => setShowForm(true)}>Nueva cita</Button>
                )
              }
            />
          ) : (
            <AppointmentTable
              appointments={filtered}
              userRole={user?.role}
              onDetail={handleDetail}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* New / Edit form */}
      {showForm && (
        <AppointmentForm
          appointment={editingAppointment}
          doctors={doctors}
          preselectedDoctorId={preselectedDoctorId}
          onSuccess={handleFormSuccess}
          onClose={handleFormClose}
        />
      )}

      {/* Detail modal */}
      {detailAppointment && (
        <AppointmentDetailModal
          appointment={detailAppointment}
          userRole={user?.role}
          onClose={() => setDetailAppointment(null)}
          onEdit={(a) => {
            setDetailAppointment(null);
            handleEdit(a);
          }}
          onDelete={(id) => {
            setDetailAppointment(null);
            handleDelete(id);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    neutral: "stat--neutral",
    blue: "stat--blue",
    green: "stat--green",
    red: "stat--red",
  };
  return (
    <div className={`stat-card ${colors[color]}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
