function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function TopDoctors({ doctors }) {
  const max = Math.max(...doctors.map((d) => d.apptCount), 1);

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <p className="dash-card-title">Médicos con más citas</p>
      </div>

      {doctors.every((d) => d.apptCount === 0) ? (
        <p className="text-muted text-sm" style={{ padding: "12px 0" }}>Sin citas registradas aún.</p>
      ) : (
        <div className="top-doctors-list">
          {doctors.map((doctor, idx) => {
            const pct = (doctor.apptCount / max) * 100;
            return (
              <div key={doctor.id} className="top-doctor-item">
                <span className="top-doctor-rank">{idx + 1}</span>
                <div className="top-doctor-avatar">{getInitials(doctor.full_name)}</div>
                <div className="top-doctor-info">
                  <p className="top-doctor-name">{doctor.full_name}</p>
                  <div className="top-doctor-bar-wrap">
                    <div
                      className="top-doctor-bar"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="top-doctor-count">{doctor.apptCount}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}