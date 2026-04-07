interface ArgusLogoProps {
  /** Height of the icon in pixels. Width scales proportionally. */
  size?: number;
  className?: string;
}

export default function ArgusLogo({ size = 32, className = '' }: ArgusLogoProps) {
  return (
    <img
      src="/argus.png"
      alt="Argus logo"
      height={size}
      style={{ height: size, width: 'auto' }}
      className={className}
    />
  );
}
