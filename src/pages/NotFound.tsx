// MINED — 404.
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';

export function NotFound() {
  return (
    <div className="page-center" style={{ textAlign: 'center' }}>
      <Logo size="md" />
      <h1 className="mt-3">⛏️ Nothing to mine here</h1>
      <p className="muted">The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="mt-2" style={{ display: 'inline-block' }}><Button>Back to MINED</Button></Link>
    </div>
  );
}
