const GENDER_MAP = {
  male:   { label: "Masculino", cls: "badge--blue" },
  female: { label: "Femenino",  cls: "badge--pink" },
  other:  { label: "Otro",      cls: "badge--gray" },
};

export default function GenderBadge({ gender }) {
  const config = GENDER_MAP[gender] || { label: "—", cls: "badge--gray" };
  if (!gender) return <span className="text-muted text-sm">—</span>;
  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}