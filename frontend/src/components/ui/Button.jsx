// Boton del design system — usa las clases .btn de nota.css
// para garantizar contraste consistente en toda la app.
const VARIANTS = {
  primary:   'btn--primary',
  secondary: 'btn--secondary',
  danger:    'btn--danger',
  ghost:     'btn--ghost',
};

const SIZES = {
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
};

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
