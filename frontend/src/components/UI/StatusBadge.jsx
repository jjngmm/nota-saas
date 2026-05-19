import React from 'react';

const StatusBadge = ({ status, variant = 'default' }) => {
  const statusStyles = {
    'Recepcionada': {
      bg: '#FFF3E0',
      text: '#8A5000',
      border: '#F5C97A'
    },
    'En consulta': {
      bg: '#EAF0EB',
      text: '#2D5A3D',
      border: '#B8CEBC'
    },
    'Pendiente': {
      bg: '#F5F5F5',
      text: '#888888',
      border: '#DDDDDD'
    },
    'Completada': {
      bg: '#EAF0EB',
      text: '#2D5A3D',
      border: '#B8CEBC'
    },
    'Cancelada': {
      bg: '#FCECEA',
      text: '#C0392B',
      border: '#F0BABA'
    },
    'default': {
      bg: '#F0F1F3',
      text: '#7A8A96',
      border: '#D8DCE0'
    }
  };

  const style = statusStyles[status] || statusStyles['default'];

  return (
    <span
      className="px-3 py-1 text-xs font-medium rounded-full"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `0.5px solid ${style.border}`
      }}
    >
      {status}
    </span>
  );
};

export default StatusBadge;