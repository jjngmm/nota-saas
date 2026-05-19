import React from 'react';

const EmptyState = ({ 
  icon = '📋',
  title = 'Sin resultados',
  description = 'No hay datos para mostrar',
  action,
  actionLabel = 'Crear nuevo'
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      <div className="text-5xl">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold text-[#0D1117] mb-2">
          {title}
        </h3>
        <p className="text-sm text-[#7A8A96] max-w-sm">
          {description}
        </p>
      </div>
      {action && (
        <button
          onClick={action}
          className="mt-4 px-4 py-2 bg-[#2D5A3D] text-white rounded-lg hover:bg-[#1B3A2A] transition-colors text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;