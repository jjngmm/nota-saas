import React from 'react';

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
  const baseStyles = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-[#2D5A3D] text-white hover:bg-[#1B3A2A] focus:ring-[#2D5A3D]',
    secondary: 'bg-[#F0F1F3] text-[#0D1117] hover:bg-[#D8DCE0] focus:ring-[#7A8A96]',
    danger: 'bg-[#C0392B] text-white hover:bg-[#A02820] focus:ring-[#C0392B]',
    ghost: 'bg-transparent text-[#2D5A3D] hover:bg-[#EAF0EB] focus:ring-[#2D5A3D]'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};


