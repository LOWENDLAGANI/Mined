// Mined — Brand logo. Uses public/assets/logo.png when provided,
// otherwise the flat ink-and-paper gem mark.
import { useState } from 'react';
import { LOGO_SOURCES } from '../assets/brand';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 20, md: 28, lg: 40, xl: 56 } as const;
  const fs = { sm: 17, md: 24, lg: 34, xl: 50 } as const;
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  return (
    <div className="logo" data-size={size}>
      <span className="logo-gem" style={{ width: sizes[size], height: sizes[size] }}>
        {!failed && srcIdx < LOGO_SOURCES.length ? (
          <img
            src={LOGO_SOURCES[srcIdx]}
            alt=""
            width="100%"
            height="100%"
            style={{ objectFit: 'contain' }}
            onError={() => {
              if (srcIdx + 1 < LOGO_SOURCES.length) setSrcIdx(srcIdx + 1);
              else setFailed(true);
            }}
          />
        ) : (
          <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
            <rect width="64" height="64" rx="12" fill="#256d54" />
            <path d="M14 48V16l10 14 8-14 8 14 10-14v32h-8V32l-10 14-10-14v16z" fill="#f4f1e8" />
          </svg>
        )}
      </span>
      <span className="logo-word" style={{ fontSize: fs[size] }}>Mined</span>
    </div>
  );
}
