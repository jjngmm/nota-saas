import { useState, useEffect } from "react";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

const GENDER_OPTIONS = [
  { value: "", label: "Seleccionar..." },
  { value: "male", label: "Masculino" },
  { value: "female", label: "Femenino" },
  { value: "other", label: "Otro" },
];

const BLOOD_TYPE_OPTIONS = [
  { value: "", label: "Seleccionar..." },
  ...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => ({
    value: t, label: t,
  })),
];

const EMPTY_FORM = {
  full_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  email: "",
  curp: "",
  blood_type: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  allergies: "",
  notes: "",
};

export default function PatientForm({ patient, onSuccess, onClose }) {
  const isEditing = !!patient;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState("personal");

  useEffect(() => {
    if (isEditing) {
      setForm({
        full_name: patient.full_name || "",
        date_of_birth: patient.date_of_birth || "",
        gender: patient.gender || "",
        phone: patient.phone || "",
        email: patient.email || "",
        curp: patient.curp || "",
        blood_type: patient.blood_type || "",
        address: patient.address || "",
        emergency_contact_name: patient.emergency_contact_name || "",
        emergency_contact_phone: patient.emergency_contact_phone || "",
        allergies: patient.allergies || "",
        notes: patient.notes || "",
      });
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  }

  function validate() {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = "El nombre es requerido";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Email inválido";
    }
    if (form.curp && form.curp.length !== 18) {
      errs.curp = "La CURP debe tener 18 caracteres";
    }
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setApiError(null);
    try {
      let res;
      if (isEditing) {
        res = await api.patch(`/api/patients/${patient.id}`, form);
      } else {
        res = await api.post("/api/patients", form);
      }
      onSuccess(res.data);
    } catch (err) {
      setApiError(err.response?.data?.message || "Error al guardar el paciente.");
    } finally {
      setSaving(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const TABS = [
    { id: "personal", label: "Datos personales" },
    { id: "contact", label: "Contacto" },
    { id: "medical", label: "Datos médicos" },
  ];

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal modal--lg">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {isEditing ? "Editar paciente" : "Nuevo paciente"}
            </h3>
            <p className="modal-subtitle">
              {isEditing ? `Editando: ${patient.full_name}` : "Completa los datos del paciente"}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`modal-tab ${activeTab === tab.id ? "modal-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {apiError && <div className="form-error-banner">{apiError}</div>}

          {/* Tab: Personal */}
          {activeTab === "personal" && (
            <div className="form-grid">
              <div className="form-field form-field--full">
                <Input
                  label="Nombre completo"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="Nombre completo del paciente"
                  required
                  error={errors.full_name}
                />
              </div>
              <div className="form-field">
                <Input
                  label="Fecha de nacimiento"
                  type="date"
                  name="date_of_birth"
                  value={form.date_of_birth}
                  onChange={handleChange}
                />
              </div>
              <div className="form-field">
                <Select
                  label="Género"
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  options={GENDER_OPTIONS}
                />
              </div>
              <div className="form-field form-field--full">
                <Input
                  label="CURP"
                  name="curp"
                  value={form.curp}
                  onChange={(e) =>
                    handleChange({ target: { name: "curp", value: e.target.value.toUpperCase() } })
                  }
                  placeholder="18 caracteres"
                  error={errors.curp}
                />
              </div>
              <div className="form-field">
                <Select
                  label="Tipo de sangre"
                  name="blood_type"
                  value={form.blood_type}
                  onChange={handleChange}
                  options={BLOOD_TYPE_OPTIONS}
                />
              </div>
            </div>
          )}

          {/* Tab: Contact */}
          {activeTab === "contact" && (
            <div className="form-grid">
              <div className="form-field">
                <Input
                  label="Teléfono"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="10 dígitos"
                />
              </div>
              <div className="form-field">
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                  error={errors.email}
                />
              </div>
              <div className="form-field form-field--full">
                <label className="input-label">Dirección</label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Calle, número, colonia, ciudad..."
                  rows={2}
                  className="textarea-el"
                />
              </div>
              <div className="form-field">
                <Input
                  label="Contacto de emergencia"
                  name="emergency_contact_name"
                  value={form.emergency_contact_name}
                  onChange={handleChange}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="form-field">
                <Input
                  label="Teléfono de emergencia"
                  name="emergency_contact_phone"
                  value={form.emergency_contact_phone}
                  onChange={handleChange}
                  placeholder="10 dígitos"
                />
              </div>
            </div>
          )}

          {/* Tab: Medical */}
          {activeTab === "medical" && (
            <div className="form-grid">
              <div className="form-field form-field--full">
                <label className="input-label">Alergias</label>
                <textarea
                  name="allergies"
                  value={form.allergies}
                  onChange={handleChange}
                  placeholder="Medicamentos, alimentos, materiales..."
                  rows={3}
                  className="textarea-el"
                />
              </div>
              <div className="form-field form-field--full">
                <label className="input-label">Notas clínicas</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Antecedentes, condiciones crónicas, observaciones..."
                  rows={4}
                  className="textarea-el"
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {/* Tab navigation inside footer */}
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            {activeTab !== "personal" && (
              <Button variant="ghost" onClick={() => {
                const idx = TABS.findIndex((t) => t.id === activeTab);
                setActiveTab(TABS[idx - 1].id);
              }}>
                ← Anterior
              </Button>
            )}
            {activeTab !== "medical" && (
              <Button variant="secondary" onClick={() => {
                const idx = TABS.findIndex((t) => t.id === activeTab);
                setActiveTab(TABS[idx + 1].id);
              }}>
                Siguiente →
              </Button>
            )}
          </div>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Registrar paciente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
