// Mined — My Quizzes: list + CRUD actions.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, EmptyState, Modal } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import { subscribeTeacherQuizzes, duplicateQuiz, deleteQuiz, updateQuiz } from '../../lib/firestore';
import type { Quiz } from '../../lib/types';
import { timeAgo } from '../../lib/format';

export function TeacherQuizzes() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Quiz | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<{ technical: string; hint: string } | null>(null);

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setActionError(describeError(e, 'quiz list action'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeTeacherQuizzes(profile.uid, (qs) => { setQuizzes(qs); setLoading(false); });
    return unsub;
  }, [profile]);

  if (!profile) return null;

  return (
    <div>
      <div className="row-between mb-2">
        <h1>My Quizzes</h1>
        <Link to="/teacher/quizzes/new"><Button>Create quiz</Button></Link>
      </div>

      {actionError && (
        <ErrorBanner
          title="The action didn't complete"
          message="Duplicate / publish / delete failed. Your quizzes are unchanged — try again."
          technical={actionError.technical}
          hint={actionError.hint}
          onDismiss={() => setActionError(null)}
        />
      )}

      {loading ? (
        <p className="muted">Loading quizzes…</p>
      ) : quizzes.length === 0 ? (
        <EmptyState icon="📚" title="No quizzes yet" hint="Create your first quiz to run it live with a PIN." />
      ) : (
        <div className="grid grid-auto">
          {quizzes.map((q) => (
            <Card key={q.id}>
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{q.title}</h3>
                <span className={`badge ${q.published ? 'ok-text' : ''}`}>{q.published ? '● Published' : '○ Draft'}</span>
              </div>
              <p className="muted" style={{ minHeight: 40, margin: '8px 0' }}>{q.description || 'No description'}</p>
              <div className="row-between muted" style={{ fontSize: '0.85rem' }}>
                <span>{q.subject || 'General'} · {q.difficulty}</span>
                <span>{q.questionCount} questions · {timeAgo(q.updatedAt)}</span>
              </div>
              <div className="row mt-1" style={{ flexWrap: 'wrap' }}>
                <Link to={`/teacher/quizzes/${q.id}`}><Button size="sm">Edit</Button></Link>
                <Link to={`/teacher/quizzes/${q.id}?start=1`}><Button size="sm" variant="success">Host</Button></Link>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction(() => duplicateQuiz(q))}>Duplicate</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction(() => updateQuiz(q.id, { published: !q.published }))}>
                  {q.published ? 'Unpublish' : 'Publish'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(q)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete quiz?">
        <p>“{confirmDelete?.title}” and all its questions will be permanently deleted.</p>
        <div className="row">
          <Button variant="danger" onClick={async () => { if (confirmDelete) { await runAction(() => deleteQuiz(confirmDelete.id)); setConfirmDelete(null); } }}>Delete permanently</Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
