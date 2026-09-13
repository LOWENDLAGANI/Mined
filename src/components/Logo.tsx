// MINED — Brand logo.
export function Logo({ size = 'md', tagline = false }: { size?: 'sm' | 'md' | 'lg' | 'xl'; tagline?: boolean }) {
  const sizes = { sm: 22, md: 30, lg: 44, xl: 64 } as const;
  const fs = { sm: 18, md: 26, lg: 40, xl: 58 } as const;
  return (
    <div className="logo" data-size={size}>
      <span className="logo-gem" style={{ width: sizes[size], height: sizes[size] }}>
        <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#6c5ce7" />
          <path d="M14 48V16l10 14 8-14 8 14 10-14v32h-8V32l-10 14-10-14v16z" fill="#fff" />
        </svg>
      </span>
      <span className="logo-word" style={{ fontSize: fs[size] }}>MINED</span>
      {tagline && <span className="logo-tagline">Learn. Play. Level Up.</span>}
    </div>
  );
}
