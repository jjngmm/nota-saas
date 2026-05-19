const ICONS = {
  calendar: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  stethoscope: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11a4 4 0 008 0V3M3 9h18" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const COLOR_MAP = {
  accent: { bg: "var(--accent-soft)", icon: "var(--accent)", border: "var(--accent)" },
  green:  { bg: "var(--success-soft)", icon: "var(--success)", border: "var(--success)" },
  blue:   { bg: "#eff6ff", icon: "#1d4ed8", border: "#3b82f6" },
  teal:   { bg: "#f0fdfa", icon: "#0f766e", border: "#14b8a6" },
};

export default function KpiCard({ label, value, delta, deltaLabel, icon, color = "accent" }) {
  const c = COLOR_MAP[color];
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: c.bg, color: c.icon }}>
          {ICONS[icon]}
        </div>
        <span className="kpi-label">{label}</span>
      </div>

      <div className="kpi-value" style={{ "--kpi-accent": c.border }}>
        {value}
      </div>

      {(delta !== null && delta !== undefined) && (
        <div className={`kpi-delta ${isPositive ? "kpi-delta--up" : isNegative ? "kpi-delta--down" : "kpi-delta--neutral"}`}>
          {isPositive && (
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          )}
          {isNegative && (
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          <span>
            {isPositive ? "+" : ""}{delta} {deltaLabel}
          </span>
        </div>
      )}

      {delta === null && deltaLabel && (
        <div className="kpi-delta kpi-delta--neutral">
          <span>{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
