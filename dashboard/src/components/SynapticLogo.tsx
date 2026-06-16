import React from 'react';

interface SynapticLogoProps {
  size?: number;
  className?: string;
}

export const SynapticLogo: React.FC<SynapticLogoProps> = ({ size = 32, className }) => {
  return (
    <img
      src="/logo.png"
      alt="Synaptic Logo"
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: '20%',
        objectFit: 'contain',
        boxShadow: '0 0 15px rgba(134, 59, 255, 0.5)',
        border: '1.5px solid rgba(134, 59, 255, 0.4)',
        background: '#0a0a16',
        padding: '2px'
      }}
    />
  );
};
