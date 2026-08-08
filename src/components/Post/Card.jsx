import React from 'react';

const Card = ({
  children,
  className = '',
  hoverEffect = true,
  onClick,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-[24px]
        bg-[#120F24]/90 border border-white/[0.07] backdrop-blur-3xl
        shadow-[0_16px_48px_rgba(0,0,0,0.5)]
        transition-all duration-300 ease-out
        ${hoverEffect ? 'hover:bg-[#181430]/95 hover:border-[#6C3BFF]/45 hover:shadow-[0_20px_40px_rgba(108,59,255,0.18)] hover:-translate-y-0.5' : ''}
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${className}
      `}
      {...props}
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#6C3BFF]/5 to-[#FF4FA3]/5 opacity-40 pointer-events-none" />
      {children}
    </div>
  );
};

export default Card;
