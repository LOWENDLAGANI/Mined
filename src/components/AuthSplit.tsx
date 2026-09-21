// Mined — Split-screen auth layout.
//
// Desktop (≥901px): two halves — form on the left, picture panel on the right.
// Phones (≤900px): no split; instead the AUTH_PANEL image becomes a blurred
// full-page background behind the form card, with a dark scrim for contrast.
//
// The picture file lives at public/assets/auth-panel.jpg (or .png/.webp — see
// AUTH_PANEL_SOURCES). If it's missing, a styled brand-gradient panel shows
// instead, so the layout never looks broken while the image hasn't been
// uploaded yet.
import { useState, type ReactNode } from 'react';
import { Logo } from './Logo';
import { AUTH_PANEL_SOURCES } from '../assets/brand';

export function AuthSplit({ children, tagline }: { children: ReactNode; tagline?: string }) {
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const hasImage = !failed && srcIdx < AUTH_PANEL_SOURCES.length;
  const src = hasImage ? AUTH_PANEL_SOURCES[srcIdx] : null;

  return (
    <div className="auth-split">
      {/* Phones: blurred full-screen photo behind everything. */}
      {hasImage && (
        <div className="auth-split-mobile-bg" aria-hidden="true">
          <img
            src={src!}
            alt=""
            onError={() => {
              if (srcIdx + 1 < AUTH_PANEL_SOURCES.length) setSrcIdx(srcIdx + 1);
              else setFailed(true);
            }}
          />
        </div>
      )}

      {/* Desktop: left = form, right = picture panel. */}
      <div className="auth-split-form">
        <div className="auth-split-card">
          <div className="auth-split-brand"><Logo size="md" /></div>
          {children}
        </div>
      </div>

      <div className="auth-split-side" aria-hidden={!hasImage}>
        {hasImage ? (
          <img
            src={src!}
            alt=""
            onError={() => {
              if (srcIdx + 1 < AUTH_PANEL_SOURCES.length) setSrcIdx(srcIdx + 1);
              else setFailed(true);
            }}
          />
        ) : (
          <div className="auth-split-side-fallback">
            <Logo size="xl" />
            <p>{tagline ?? 'Live quizzes for the classroom.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
