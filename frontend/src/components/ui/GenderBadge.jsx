import React from 'react';

const GenderBadge = ({ gender }) => {
  const genderStyles = {
    'Masculino': {
      bg: '#E3F2FD',
      text: '#1565C0',
      border: '#90CAF9',
      icon: '♂'
    },
    'Femenino': {
      bg: '#FCE4EC',
      text: '#C2185B',
      border: '#F48FB1',
      icon: '♀'
    },
    'Otro': {
      bg: '#F3E5F5',
      text: '#7B1FA2',
      border: '#CE93D8',
      icon: '⊗'
    },
    'M': {
      bg: '#E3F2FD',
      text: '#1565C0',
      border: '#90CAF9',
      icon: '♂'
    },
    'F': {
      bg: '#FCE4EC',
      text: '#C2185B',
      border: '#F48FB1',
      icon: '♀'
    }
  };

  const style = genderStyles[gender] || genderStyles['Otro'];

  return (
    <span
      className="px-2 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `0.5px solid ${style.border}`
      }}
    >
      <span>{style.icon}</span>
      {gender}
    </span>
  );
};

export default GenderBadge;