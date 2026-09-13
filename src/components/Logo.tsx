// Mined — Brand logo. Flat ink-and-paper mark, no gradients or glow.
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl'; tagline?: boolean }) {
  const sizes = { sm: 20, md: 28, lg: 40, xl: 56 } as const;
  const fs = { sm: 17, md: 24, lg: 34, xl: 50 } as const;
  return (
    <div className="logo" data-size={size}>
      <span className="logo-gem" style={{ width: sizes[size], height: sizes[size] }}>
        <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
          <rect width="64" height="64" rx="12" fill="#256d54" />
          <path d="M14 48V16l10 14 8-14 8 14 10-14v32h-8V32l-10 14-10-14v16z" fill="#f4f1e8" />
        </svg>
      </span>
      <span className="logo-word" style={{ fontSize: fs[size] }}>Mined</span>
    </div>
  );
}
