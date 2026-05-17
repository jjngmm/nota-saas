// LoadingSpinner.jsx
export default function LoadingSpinner({ message = "Cargando..." }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <p className="spinner-msg">{message}</p>
    </div>
  );
}