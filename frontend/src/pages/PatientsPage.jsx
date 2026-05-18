import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";
import PatientTable from "../components/patients/PatientTable";
import PatientForm from "../components/patients/PatientForm";
import PatientDetailModal from "../components/patients/PatientDetailModal";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";

const GENDER_OPTIONS = [
  { value: "", label: "Todos los géneros" },
  { value: "male", label: "Masculino" },
  { value: "female", label: "Femenino" },
  { value: "other", label: "Otro" },
];

export default function PatientsPage() {
  const { user } = useAuth();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [detailPatient, setDetailPatient] = useState(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  async function fetchPatients() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/patients");
      setPatients(res.data || []);
    } catch {
      setError("No se pudieron cargar los pacientes.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(patient) {
    setEditingPatient(patient);
    setShowForm(true);
  }

  function handleDetail(patient) {
    setDetailPatient(patient);
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este paciente? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/api/patients/${id}`);
      setPatients((prev) => prev.filter((p) => p.id !== id));
      setDetailPatient(null);
    } catch {
      alert("Error al eliminar el paciente.");
    }
  }

  function handleFormSuccess(saved) {
    if (editingPatient) {
      setPatients((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    } else {
      setPatients((prev) => [saved, ...prev]);
    }
    setShowForm(false);
    setEditingPatient(null);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingPatient(null);
  }

  const filtered = patients.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      p.full_name?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.phone?.toLowerCase().includes(term) ||
      p.curp?.toLowerCase().includes(term);
    const matchGender = !filterGender || p.gender === filterGender;
    return matchSearch && matchGender;
  });

  const stats = {
    total: patients.length,
    male: patients.filter((p) => p.gender === "male").length,
    female: patients.filter((p) => p.gender === "female").length,
  };

  const isSecretary = user?.role === "secretary" || user?.role === "admin";

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar
          title="Pacientes"
          actions={
            isSecretary && (
              <Button onClick={() => setShowForm(true)}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo paciente
              </Button>
            )
          }
        />

        <div className="nota-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Directorio de Pacientes</h1>
              <p className="page-subtitle">
                {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
                {filtered.length !== patients.length && ` de ${patients.length}`}
              </p>
            </div>
          </div>

          {/* Stats */}
          {!loading && !error && (
            <div className="stats-row stats-row--3">
              <StatCard label="Total" value={stats.total} color="neutral" icon="users" />
              <StatCard label="Masculino" value={stats.male} color="blue" icon="male" />
              <StatCard label="Femenino" value={stats.female} color="pink" icon="female" />
            </div>
          )}

          {/* Filters */}
          <div className="filters-bar">
            <Input
              placeholder="Buscar por nombre, teléfono, CURP..."
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
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              options={GENDER_OPTIONS}
            />
            {(search || filterGender) && (
              <button
                className="action-link"
                onClick={() => { setSearch(""); setFilterGender(""); }}
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <LoadingSpinner message="Cargando pacientes..." />
          ) : error ? (
            <EmptyState
              icon="error"
              title="Error al cargar"
              description={error}
              action={<Button onClick={fetchPatients}>Reintentar</Button>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="empty"
              title="Sin pacientes"
              description={
                search || filterGender
                  ? "No hay pacientes que coincidan con los filtros."
                  : "No hay pacientes registrados aún."
              }
              action={
                isSecretary && (
                  <Button onClick={() => setShowForm(true)}>Nuevo paciente</Button>
                )
              }
            />
          ) : (
            <PatientTable
              patients={filtered}
              onDetail={handleDetail}
              onEdit={isSecretary ? handleEdit : null}
            />
          )}
        </div>
      </div>

      {showForm && (
        <PatientForm
          patient={editingPatient}
          onSuccess={handleFormSuccess}
          onClose={handleFormClose}
        />
      )}

      {detailPatient && (
        <PatientDetailModal
          patient={detailPatient}
          isSecretary={isSecretary}
          onClose={() => setDetailPatient(null)}
          onEdit={(p) => { setDetailPatient(null); handleEdit(p); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  const colors = {
    neutral: "stat--neutral",
    blue: "stat--blue",
    pink: "stat--pink",
  };
  return (
    <div className={`stat-card ${colors[color]}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}