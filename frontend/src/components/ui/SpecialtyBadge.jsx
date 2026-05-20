const SpecialtyBadge = ({ specialty }) => {
  const specialtyIcons = {
    'Cardiología': '❤️',
    'Dermatología': '🔬',
    'Oftalmología': '👁️',
    'Otorrinolaringología': '👂',
    'Neumología': '🫁',
    'Neurología': '🧠',
    'Pediatría': '👶',
    'Psiquiatría': '🧠',
    'Ortopedia': '🦴',
    'Gastroenterología': '🍽️',
    'Endocrinología': '⚖️',
    'Reumatología': '💪',
    'Ginecología': '🏥',
    'Urología': '🏥',
    'Medicina General': '🩺'
  };

  const icon = specialtyIcons[specialty] || '🏥';

  return (
    <span
      className="px-3 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1.5 bg-[#EAF0EB] text-[#2D5A3D] border border-[#B8CEBC]"
    >
      <span>{icon}</span>
      {specialty}
    </span>
  );
};

export default SpecialtyBadge;