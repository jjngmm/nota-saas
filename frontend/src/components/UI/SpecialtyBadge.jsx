const SPECIALTY_COLORS = {
  "Medicina General": "badge--blue",
  "Pediatría": "badge--green",
  "Cardiología": "badge--red",
  "Ginecología": "badge--purple",
  "Traumatología": "badge--orange",
  "Neurología": "badge--indigo",
  "Dermatología": "badge--pink",
  "Oftalmología": "badge--teal",
  "Ortopedia": "badge--yellow",
  "Psiquiatría": "badge--violet",
};

function getColor(specialty) {
  if (!specialty) return "badge--gray";
  return SPECIALTY_COLORS[specialty] || "badge--gray";
}

export default function SpecialtyBadge({ specialty }) {
  if (!specialty) return <span className="badge badge--gray">—</span>;
  return (
    <span className={`badge ${getColor(specialty)}`}>
      {specialty}
    </span>
  );
}