import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import PatientTable from '../components/patients/PatientTable';
import PatientForm from '../components/patients/PatientForm';
import PatientDetailModal from '../components/patients/PatientDetailModal';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const GENDER_OPTIONS = [
  { value: '', label: 'Todos los sexos' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
];

export default function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Búsqueda
  const [search, setSearch]         = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [filterDx, setFilterDx]     = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Modales
  const [showForm, setShowForm]     = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [detailPatient, setDetailPatient]   = useState(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params = new URLSearchParams();
      if (search)       params.set('q', search);
      if (filterGender) params.set('gender', filterGender);
      if (filterAgeMin) params.set('age_min', filterAgeMin);
      if (filterAgeMax) params.set('age_max', filterAgeMax);
      if (filterDx)     params.set('diagnostico', filterDx);

      const endpoint = filterDx
        ? `/api/patients/search?${params}`
        : `/api/patients?${params}`;

      const res = await api.get(endpoint);
      const data = filterDx ? (res.data.data || []) : (Array.isArray(res.data) ? res.data : []);
      setPatients(data);
    } catch {
      setError('No se pudieron cargar los pacientes.');
    } finally { setLoading(false); }
  }, [search, filterGender, filterAgeMin, filterAgeMax, filterDx]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  function handleEdit(p)   { setEditingPatient(p); setShowForm(true); }
  function handleDetail(p) { setDetailPatient(p); }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este paciente?')) return;
    try {
      await api.delete(`/api/patients/${id}`);
      setPatients(prev => prev.filter(p => p.id !== id));
      setDetailPatient(null);
    } catch { alert('Error al eliminar el paciente.'); }
  }

  function handleFormSuccess(saved) {
    if (editingPatient) {
      setPatients(prev => prev.map(p => p.id === saved.id ? saved : p));
    } else {
      setPatients(prev => [saved, ...prev]);
    }
    setShowForm(false);
    setEditingPatient(null);
  }

  function clearFilters() {
    setSearch(''); setFilterGender('');
    setFilterAgeMin(''); setFilterAgeMax('');
    setFilterDx('');
  }

  const hasFilters = search || filterGender || filterAgeMin || filterAgeMax || filterDx;
  const isSecretary = user?.role === 'secretary';
  const canCreate   = ['admin', 'doctor', 'secretary'].includes(user?.role);

  const stats = {
    total:    patients.length,
    masculino: patients.filter(p => p.gender === 'masculino').length,
    femenino:  patients.filter(p => p.gender === 'femenino').length,
    menores:   patients.filter(p => p.is_minor).length,
  };

  return (
    <div className="nota-layout">
      <Sidebar />
      <div className="nota-main">
        <Navbar
          title="Pacientes"
          actions={canCreate && (
            <Button onClick={() => setShowForm(true)}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo paciente
            </Button>
          )}
        />

        <div className="nota-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Directorio de Pacientes</h1>
              <p className="page-subtitle">
                {patients.length} paciente{patients.length !== 1 ? 's' : ''}
                {hasFilters ? ' encontrados' : ' registrados'}
              </p>
            </div>
          </div>

          {/* Stats */}
          {!loading && !error && (
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[
                { label: 'Total',     value: stats.total,    color: 'stat--neutral' },
                { label: 'Masculino', value: stats.masculino, color: 'stat--blue' },
                { label: 'Femenino',  value: stats.femenino,  color: 'stat--green' },
                { label: 'Menores',   value: stats.menores,   color: 'stat--neutral' },
              ].map(s => (
                <div key={s.label} className={`stat-card ${s.color}`}>
                  <span className="stat-value">{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Búsqueda */}
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '1rem 1.1rem', marginBottom: '1.25rem' }}>
            {/* Búsqueda principal */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  className="input-el" style={{ paddingLeft: 34, height: 36 }}
                  placeholder="Buscar por nombre, teléfono, email, CURP..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="input-el" style={{ width: 160, height: 36 }} value={filterGender}
                onChange={e => setFilterGender(e.target.value)}>
                {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                onClick={() => setShowAdvanced(p => !p)}
                className="est-quick-btn"
                style={{ height: 36, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {showAdvanced ? '▲' : '▼'} Búsqueda avanzada
              </button>
              {hasFilters && (
                <button className="action-link" onClick={clearFilters} style={{ fontSize: '0.82rem' }}>
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Filtros avanzados */}
            {showAdvanced && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Edad mín.</label>
                  <input type="number" className="input-el" style={{ width: 90, height: 34 }} value={filterAgeMin}
                    onChange={e => setFilterAgeMin(e.target.value)} placeholder="0" min="0" max="120" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Edad máx.</label>
                  <input type="number" className="input-el" style={{ width: 90, height: 34 }} value={filterAgeMax}
                    onChange={e => setFilterAgeMax(e.target.value)} placeholder="120" min="0" max="120" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Buscar por diagnóstico</label>
                  <input className="input-el" style={{ height: 34 }} value={filterDx}
                    onChange={e => setFilterDx(e.target.value)}
                    placeholder="Ej. Hipertensión, Diabetes..." />
                </div>
                {filterDx && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-40)', background: 'var(--forest-soft)', border: '0.5px solid var(--forest-lite)', borderRadius: 6, padding: '0.25rem 0.5rem' }}>
                      🔍 Busca en notas clínicas
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contenido */}
          {loading ? (
            <LoadingSpinner message="Buscando pacientes..." />
          ) : error ? (
            <EmptyState icon="error" title="Error al cargar" description={error}
              action={<Button onClick={fetchPatients}>Reintentar</Button>} />
          ) : patients.length === 0 ? (
            <EmptyState
              icon="empty"
              title={hasFilters ? 'Sin resultados' : 'Sin pacientes'}
              description={hasFilters
                ? 'No hay pacientes que coincidan con los filtros.'
                : 'No hay pacientes registrados aún.'}
              action={canCreate && !hasFilters && <Button onClick={() => setShowForm(true)}>Nuevo paciente</Button>}
            />
          ) : (
            <PatientTable
              patients={patients}
              onDetail={handleDetail}
              onEdit={canCreate ? handleEdit : null}
            />
          )}
        </div>
      </div>

      {showForm && (
        <PatientForm
          patient={editingPatient}
          onSuccess={handleFormSuccess}
          onClose={() => { setShowForm(false); setEditingPatient(null); }}
        />
      )}

      {detailPatient && (
        <PatientDetailModal
          patient={detailPatient}
          isSecretary={isSecretary}
          onClose={() => setDetailPatient(null)}
          onEdit={p => { setDetailPatient(null); handleEdit(p); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
