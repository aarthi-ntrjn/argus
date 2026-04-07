interface ArgusLogoProps {
  /** Height of the icon in pixels. Width scales proportionally (80:120 ratio). */
  size?: number;
  className?: string;
}

/**
 * Argus diamond eye logo — matches the reference design:
 * a light-blue diamond with a dark-blue eyeball clipped inside,
 * slightly off-centre to the right, with a small green iris detail.
 */
export default function ArgusLogo({ size = 32, className = '' }: ArgusLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Argus logo"
      role="img"
      className={className}
    >
      <defs>
        <clipPath id="argus-diamond-clip">
          <polygon points="90,8 172,90 90,172 8,90" />
        </clipPath>
      </defs>

      {/* Light blue diamond (sclera) */}
      <polygon points="90,8 172,90 90,172 8,90" fill="#88C5EA" />

      {/* Dark blue eyeball clipped to diamond */}
      <g clipPath="url(#argus-diamond-clip)">
        <circle cx="100" cy="90" r="74" fill="#1A5DBF" />
        <circle cx="100" cy="90" r="54" fill="#1248A0" />
        <circle cx="91"  cy="97" r="8"  fill="#2E9E52" />
      </g>

      {/* Eyeball circle outline */}
      <g clipPath="url(#argus-diamond-clip)">
        <circle cx="100" cy="90" r="74" fill="none" stroke="#0a0a1a" strokeWidth={5} />
      </g>

      {/* Diamond outline */}
      <polygon
        points="90,8 172,90 90,172 8,90"
        fill="none"
        stroke="#0a0a1a"
        strokeWidth={5}
        strokeLinejoin="miter"
      />
    </svg>
  );
}
