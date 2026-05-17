// Button.jsx
export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}) {
  const base = "btn";
  const variants = {
    primary: "btn--primary",
    secondary: "btn--secondary",
    ghost: "btn--ghost",
    danger: "btn--danger",
  };
  const sizes = {
    sm: "btn--sm",
    md: "btn--md",
    lg: "btn--lg",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}