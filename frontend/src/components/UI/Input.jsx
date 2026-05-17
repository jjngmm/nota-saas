export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  icon,
  error,
  required,
  disabled,
  name,
}) {
  return (
    <div className="input-wrapper">
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className={`input-field ${icon ? "input-field--icon" : ""} ${error ? "input-field--error" : ""}`}>
        {icon && <span className="input-icon">{icon}</span>}
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className="input-el"
        />
      </div>
      {error && <p className="input-error-msg">{error}</p>}
    </div>
  );
}