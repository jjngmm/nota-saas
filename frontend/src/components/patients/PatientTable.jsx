import GenderBadge from "../ui/GenderBadge";

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function PatientTable({ patients, onDetail, onEdit }) {
  return (
    <div className="table-wrapper">
      <table className="nota-table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Género</th>
            <th>Edad</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>CURP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => {
            const age = calcAge(p.date_of_birth);
            return (
              <tr key={p.id} className="table-row-clickable" onClick={() => onDetail(p)}>
                <td>
                  <div className="patient-cell">
                    <div className="patient-avatar patient-avatar--lg">
                      {getInitials(p.full_name)}
                    </div>
                    <div>
                      <p className="patient-name">{p.full_name}</p>
                      {p.date_of_birth && (
                        <p className="patient-dob text-muted text-sm">
                          {formatDate(p.date_of_birth)}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td><GenderBadge gender={p.gender} /></td>
                <td>
                  <span className="text-sm">{age !== null ? `${age} años` : "—"}</span>
                </td>
                <td><span className="text-muted text-sm">{p.phone || "—"}</span></td>
                <td><span className="text-muted text-sm">{p.email || "—"}</span></td>
                <td>
                  <span className="text-muted text-sm font-mono">{p.curp || "—"}</span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    {onEdit && (
                      <button className="action-link" onClick={() => onEdit(p)}>
                        Editar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}