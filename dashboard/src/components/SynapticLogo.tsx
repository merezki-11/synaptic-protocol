interface SynapticLogoProps {
  size?: number;
  className?: string;
}

export const SynapticLogo: React.FC<SynapticLogoProps> = ({ size = 32, className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer hexagonal frame */}
      <path
        d="M24 2L43 13V35L24 46L5 35V13L24 2Z"
        stroke="url(#synaptic-gradient)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
      
      {/* Inner neural hub - center node */}
      <circle cx="24" cy="24" r="4" fill="url(#synaptic-gradient)" opacity="0.9" />
      <circle cx="24" cy="24" r="6" stroke="url(#synaptic-gradient)" strokeWidth="0.8" fill="none" opacity="0.3" />
      
      {/* Synaptic dendrite paths - top */}
      <path
        d="M24 18V10M24 10L19 6M24 10L29 6"
        stroke="url(#synaptic-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      
      {/* Synaptic dendrite paths - bottom-left */}
      <path
        d="M19.5 27.5L13 34M13 34L8 34M13 34L11 39"
        stroke="url(#synaptic-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      
      {/* Synaptic dendrite paths - bottom-right */}
      <path
        d="M28.5 27.5L35 34M35 34L40 34M35 34L37 39"
        stroke="url(#synaptic-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      
      {/* Axon terminals - small end nodes */}
      <circle cx="19" cy="6" r="2" fill="hsl(190, 100%, 50%)" opacity="0.8" />
      <circle cx="29" cy="6" r="2" fill="hsl(265, 90%, 64%)" opacity="0.8" />
      <circle cx="8" cy="34" r="2" fill="hsl(190, 100%, 50%)" opacity="0.8" />
      <circle cx="11" cy="39" r="2" fill="hsl(145, 85%, 45%)" opacity="0.8" />
      <circle cx="40" cy="34" r="2" fill="hsl(265, 90%, 64%)" opacity="0.8" />
      <circle cx="37" cy="39" r="2" fill="hsl(145, 85%, 45%)" opacity="0.8" />
      
      {/* Data pulse dots on paths */}
      <circle cx="24" cy="14" r="1.2" fill="hsl(190, 100%, 50%)">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="16" cy="31" r="1.2" fill="hsl(265, 90%, 64%)">
        <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="32" cy="31" r="1.2" fill="hsl(145, 85%, 45%)">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
      </circle>
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="synaptic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(190, 100%, 50%)" />
          <stop offset="50%" stopColor="hsl(265, 90%, 64%)" />
          <stop offset="100%" stopColor="hsl(145, 85%, 45%)" />
        </linearGradient>
      </defs>
    </svg>
  );
};
