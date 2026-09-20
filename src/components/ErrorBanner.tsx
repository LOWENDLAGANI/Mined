// Mined — loud, expandable error reporting.
// The user sees a friendly, impossible-to-miss banner. Clicking
// "What went wrong?" expands the technical details + a concrete fix hint so a
// developer notices the failure even when it's tucked inside a click.
// Nothing here fails silently: every banner is also logged to the console.
import { Component, useEffect, useState, type ErrorInfo as ReactErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

export interface BannerError {
  /** Short bold heading, e.g. "Couldn't load the questions". */
  title?: string;
  /** Friendly, plain-language message for the user. */
  message: string;
  /** Raw technical string (error code + original message). */
  technical?: string;
  /** What a developer should check/fix. */
  hint?: string;
}

/** Map a thrown value to technical + developer-hint text. */
export function describeError(e: unknown, context?: string): { technical: string; hint: string } {
  const obj = (e ?? {}) as { code?: string; message?: string };
  const code = obj.code ?? '';
  const msg = obj.message ?? String(e ?? 'Unknown error');
  const technical = `${context ? context + ': ' : ''}${code ? `[${code}] ` : ''}${msg}`;

  let hint: string;
  if (code.includes('unauthenticated')) {
    hint = 'The user is not signed in (or their session expired). Check that the route is wrapped in the auth guard and the ID token is fresh.';
  } else if (code.includes('permission-denied') || code.includes('permission')) {
    hint = 'Firestore security rules rejected the read/write. Check firestore.rules for this collection path and the user\'s role claim, then redeploy rules: firebase deploy --only firestore:rules';
  } else if (code.includes('not-found')) {
    hint = 'The document does not exist. Verify the ID/PIN lookup and that the session/quiz doc was actually created (check the Firestore console).';
  } else if (code.includes('invalid-argument')) {
    hint = 'The client sent a payload the Cloud Function rejected. Compare the callable\'s request shape here with the handler in functions/src/index.ts.';
  } else if (code.includes('failed-precondition')) {
    hint = 'The operation\'s preconditions failed (e.g. quiz already started/ended, or join is locked). Check the session status fields before calling.';
  } else if (code.includes('unavailable') || code.includes('network')) {
    hint = 'Backend unreachable. Check internet connectivity, and confirm the Cloud Functions are deployed to asia-northeast1: firebase deploy --only functions';
  } else if (code.includes('internal') || code.includes('unknown')) {
    hint = 'A Cloud Function threw an unhandled error. Read the stack trace: npx firebase-tools functions:log --project mined-2425';
  } else if (code.includes('resource-exhausted')) {
    hint = 'Quota/billing limit hit on Firebase. Check usage in the Firebase console (Firestore reads/writes, function invocations).';
  } else if (/not configured|\.env/i.test(msg)) {
    hint = 'Firebase env vars are missing from this build. Add VITE_FIREBASE_* keys to .env.local and rebuild: npm run build';
  } else {
    hint = 'No mapped cause — reproduce in devtools, inspect the network tab / Functions logs, and add a specific case to describeError().';
  }
  return { technical, hint };
}

interface ErrorBannerProps extends BannerError {
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  /** Optional extra action buttons (links etc.) shown next to retry/dismiss. */
  children?: ReactNode;
}

/** Loud red banner. Friendly message visible; dev details behind one click. */
export function ErrorBanner({ title = 'Something went wrong', message, technical, hint, onRetry, onDismiss, retryLabel = 'Try again', children }: ErrorBannerProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Never silent: mirror every banner in the console with full context.
    console.error(`[Mined] ${title}: ${message}`, technical ?? '', hint ?? '');
  }, [title, message, technical, hint]);

  async function copyDetails() {
    const text = [
      `Title: ${title}`,
      `Message: ${message}`,
      technical ? `Technical: ${technical}` : '',
      hint ? `Developer hint: ${hint}` : '',
      `Page: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="error-banner" role="alert">
      <div className="error-banner-title">
        <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>⚠️</span>
        <span>{title}</span>
      </div>
      <p className="error-banner-msg">{message}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {onRetry && <Button size="sm" variant="danger" onClick={onRetry}>{retryLabel}</Button>}
        {onDismiss && <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>}
        <button type="button" className="error-banner-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '▾' : '▸'} What went wrong? <span className="muted">(for developers)</span>
        </button>
        {children}
      </div>
      {open && (
        <div className="error-banner-details">
          <div><strong>Technical:</strong> <code>{technical ?? '— no technical detail captured —'}</code></div>
          {hint && <div className="mt-1"><strong>What to fix:</strong> {hint}</div>}
          <div className="mt-1"><Button size="sm" variant="secondary" onClick={copyDetails}>{copied ? 'Copied ✓' : 'Copy for bug report'}</Button></div>
        </div>
      )}
    </div>
  );
}

/** Top-level safety net: any uncaught render error becomes a loud banner. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ReactErrorInfo) {
    console.error('[Mined] Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const { technical, hint } = describeError(this.state.error, 'render');
      return (
        <div className="page-center" style={{ alignItems: 'stretch' }}>
          <div style={{ width: '100%', maxWidth: 640 }}>
            <ErrorBanner
              title="This page crashed"
              message="Reload the page to keep going. If it keeps happening, the details below show exactly why."
              technical={`${this.state.error.name}: ${this.state.error.message}`}
              hint={hint}
              onRetry={() => window.location.reload()}
              retryLabel="Reload page"
            />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
