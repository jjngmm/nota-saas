const STATUS_MAP = {
  scheduled: { label: "Programada", cls: "badge--blue" },
  confirmed: { label: "Confirmada", cls: "badge--indigo" },
  completed: { label: "Completada", cls: "badge--green" },
  cancelled: { label: "Cancelada", cls: "badge--red" },
  no_show:   { label: "No se presentó", cls: "badge--orange" },
};

export default function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status || "—", cls: "badge--gray" };
  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}