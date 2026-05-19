import React from 'react';

const Select = ({ 
  label, 
  name, 
  value, 
  onChange, 
  options, 
  placeholder = 'Selecciona una opción',
  disabled = false,
  required = false 
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
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className="px-3 py-2 border border-[#D8DCE0] rounded-lg bg-white text-[#0D1117] placeholder-[#7A8A96] focus:outline-none focus:ring-2 focus:ring-[#2D5A3D] disabled:bg-[#F0F1F3] disabled:text-[#7A8A96]"
      >
        <option value="">{placeholder}</option>
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
