// Mined — Shared UI primitives (flat paper-and-ink theme; backgrounds come
// from CSS, not inline textures).
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type CSSProperties, useEffect } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  full?: boolean;
}

export function Button({ variant = 'primary', size = 'md', full, className = '', ...rest }: BtnProps) {
  const cls = ['btn', `btn-${variant}`, `btn-${size}`, full ? 'btn-full' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest} />
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      className={`card ${onClick ? 'card-clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {children}
    </div>
  );
}

export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={`panel ${className}`} style={style}>
      {children}
    </section>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input id={inputId} className={`input ${error ? 'input-error' : ''}`} aria-invalid={!!error} {...rest} />
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, id, children, ...rest }: SelectProps) {
  const selectId = id ?? rest.name ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="field">
      {label && <label htmlFor={selectId}>{label}</label>}
      <select id={selectId} className="input select" {...rest}>
        {children}
      </select>
    </div>
  );
}

export function ProgressBar({ value, label, color, className }: { value: number; label?: string; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`progress ${className ?? ''}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="spinner-wrap" role="status" aria-label={label}><div className="spinner" /></div>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose?: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{}}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && <button className="modal-close" onClick={onClose} aria-label="Close dialog">✕</button>}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="badge" style={color ? { background: color } : undefined}>{children}</span>;
}

export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: string }) {
  return (
    <Card className="stat-card">
      {icon && <span className="stat-icon" aria-hidden="true">{icon}</span>}
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Card>
  );
}
