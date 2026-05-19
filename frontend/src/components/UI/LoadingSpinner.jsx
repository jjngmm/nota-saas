import React from 'react';

const LoadingSpinner = ({ size = 'md', text = 'Cargando...' }) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizes[size]} border-4 border-[#D8DCE0] border-t-[#2D5A3D] rounded-full animate-spin`}
      />
      {text && <p className="text-sm text-[#7A8A96]">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
