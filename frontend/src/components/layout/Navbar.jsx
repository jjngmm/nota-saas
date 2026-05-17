export default function Navbar({ title, actions }) {
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h2 className="navbar-title">{title}</h2>
        <span className="navbar-date">{today}</span>
      </div>
      {actions && <div className="navbar-actions">{actions}</div>}
    </header>
  );
}