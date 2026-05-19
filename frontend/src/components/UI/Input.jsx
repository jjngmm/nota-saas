import React from 'react';

const Input = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={name}
          className="text-sm font-medium text-[#0D1117]"
        >
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`px-3 py-2 border rounded-lg bg-white text-[#0D1117] placeholder-[#7A8A96] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] disabled:bg-[#F0F1F3] disabled:text-[#7A8A96] ${
          error ? 'border-red-500' : 'border-[#D8DCE0]'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
};

export default Input;
