// Mined — Quiz editor: quiz details + question management.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, EmptyState, Input, Modal, Panel, Select } from '../../components/ui';
import { ErrorBanner, describeError } from '../../components/ErrorBanner';
import {
  createQuiz, getQuiz, updateQuiz, subscribeQuestions,
  addQuestion, updateQuestion, deleteQuestion, duplicateQuestion, reorderQuestion,
} from '../../lib/firestore';
import type { Pacing, Question, Quiz } from '../../lib/types';

const EMPTY_Q = { question: '', options: ['', '', '', ''], correctOption: 0, explanation: '', timeLimit: 20, points: 100 };
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const PACING_OPTIONS: Array<{ id: Pacing; name: string; icon: string; blurb: string }> = [
  {
    id: 'classic',
    name: 'Classic',
    icon: '📺',
    blurb: 'You control the pace. One question at a time on the big screen, everyone answers together.',
  },
  {
    id: 'self_paced',
    name: 'Self-paced',
    icon: '🚶',
    blurb: 'Each student moves through the questions at their own speed with their own timer.',
  },
];

export function QuizEditor() {
  const { quizId } = useParams<{ quizId: string }>();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { profile } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ technical: string; hint: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<typeof EMPTY_Q & { id?: string } | null>(null);
  const [startOpen, setStartOpen] = useState(sp.get('start') === '1');
  const [actionError, setActionError] = useState<{ technical: string; hint: string } | null>(null);

  // Create or load
  // Ref guard: React StrictMode mounts effects twice in dev — without this,
  // two "Untitled Quiz" docs get created for one visit to /teacher/quizzes/new.
  const creatingRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      if (!quizId) {
        if (creatingRef.current) return;
        creatingRef.current = true;
        const id = await createQuiz(profile.uid, { title: 'Untitled Quiz' });
        if (!cancelled) { nav(`/teacher/quizzes/${id}`, { replace: true }); }
        return;
      }
      const q = await getQuiz(quizId);
      if (cancelled) return;
      if (!q || q.ownerId !== profile.uid) { nav('/teacher/quizzes', { replace: true }); return; }
      setQuiz(q); setTitle(q.title); setDescription(q.description); setSubject(q.subject);
      setDifficulty(q.difficulty); setPublished(q.published); setLoading(false);
    })().catch((e) => {
      // Was an unhandled rejection — a failed quiz load used to hang on
      // "Loading quiz…" forever. Now it shows the loud banner.
      if (!cancelled) {
        setLoadError(describeError(e, 'getQuiz'));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [quizId, profile, nav]);

  useEffect(() => {
    if (!quizId) return;
    return subscribeQuestions(quizId, setQuestions);
  }, [quizId]);

  const sorted = useMemo(() => [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [questions]);

  // Every write action reports failures loudly so the teacher never loses
  // work silently — the modal/inputs keep their state on error.
  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(describeError(e, 'quiz editor action'));
    }
  }

  function saveDetails() {
    if (!quizId) return;
    runAction(async () => {
      await updateQuiz(quizId, { title, description, subject, difficulty, published });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    });
  }

  function saveQuestion() {
    if (!quizId || !editing) return;
    const options = editing.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < MIN_OPTIONS) return;
    // Keep correctOption valid if the trimmed list shrank or the marked option
    // was removed.
    let correct = editing.correctOption;
    if (correct >= options.length) correct = 0;
    const payload = { ...editing, options, correctOption: correct };
    runAction(async () => {
      if (editing.id) await updateQuestion(quizId, editing.id, payload);
      else await addQuestion(quizId, { ...payload, order: (sorted[sorted.length - 1]?.order ?? 0) + 1 });
      setEditing(null);
    });
  }

  function move(q: Question, dir: -1 | 1) {
    if (!quizId) return;
    const idx = sorted.findIndex((x) => x.id === q.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    runAction(async () => {
      await reorderQuestion(quizId, q.id, swapWith.order);
      await reorderQuestion(quizId, swapWith.id, q.order);
    });
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 640, margin: '40px auto' }}>
        <ErrorBanner
          title="Couldn't open this quiz"
          message="The quiz didn't load, so your changes can't be saved anywhere yet. Nothing was lost."
          technical={loadError.technical}
          hint={loadError.hint}
          onRetry={() => window.location.reload()}
          retryLabel="Reload"
        />
      </div>
    );
  }
  if (loading || !quiz) return <p className="muted">Loading quiz…</p>;

  return (
    <div style={{ maxWidth: 860 }}>
      {actionError && (
        <ErrorBanner
          title="Your change wasn't saved"
          message="The last edit failed to save. Your text is still in the editor — try again, or copy it somewhere safe."
          technical={actionError.technical}
          hint={actionError.hint}
          onDismiss={() => setActionError(null)}
        />
      )}
      <div className="row-between mb-2">
        <div>
          <Link to="/teacher/quizzes" className="muted" style={{ fontSize: '0.85rem' }}>← My Quizzes</Link>
          <h1 style={{ margin: '6px 0 0' }}>{title || 'Untitled Quiz'}</h1>
        </div>
        <Button size="lg" variant="success" onClick={() => setStartOpen(true)}>Start live quiz</Button>
      </div>

      <Panel>
        <h3>Quiz details</h3>
        <Input label="Title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <Input label="Description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        <div className="grid grid-2">
          <Input label="Subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Science" />
          <Select label="Difficulty" name="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy')}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </div>
        <div className="row">
          <Button onClick={saveDetails}>Save details</Button>
          <Button variant="secondary" onClick={() => runAction(async () => {
            await updateQuiz(quizId!, { published: !published });
            setPublished(!published);
          })}>
            {published ? 'Unpublish' : 'Publish quiz'}
          </Button>
          {published && <span className="ok-text">Students can join live quizzes with this quiz.</span>}
          {saved && <span className="ok-text">Saved ✓</span>}
        </div>
        <p className="muted mt-1" style={{ fontSize: '0.85rem' }}>
          Cover image: upload via Storage at <code>quizzes/{quizId}/cover.png</code> (wire an upload control here when assets are ready).
        </p>
      </Panel>

      <div className="row-between mt-3 mb-1">
        <h2 style={{ margin: 0 }}>Questions ({sorted.length})</h2>
        <Button onClick={() => setEditing({ ...EMPTY_Q })}>+ Add question</Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="❓" title="No questions yet" hint="Add at least one question to run a live quiz." />
      ) : (
        sorted.map((q, i) => (
          <Card key={q.id} className="question-card">
            <div className="row-between">
              <strong>Q{i + 1}. {q.question || <em className="muted">(empty)</em>}</strong>
              <span className="muted" style={{ fontSize: '0.85rem' }}>{q.timeLimit}s · {q.points} pts</span>
            </div>
            <div className="grid grid-2 mt-1" style={{ fontSize: '0.92rem' }}>
              {q.options.map((o, oi) => (
                <span key={oi} className={oi === q.correctOption ? 'ok-text' : 'muted'}>
                  {oi === q.correctOption ? '✓' : '•'} {o || '(blank)'}
                </span>
              ))}
              {q.options.length < 2 && <span className="error-text">⚠ A question needs at least 2 options.</span>}
            </div>
            {q.explanation && <p className="muted mt-1" style={{ fontSize: '0.88rem', margin: 0 }}>Explanation: {q.explanation}</p>}
            <div className="row mt-1" style={{ flexWrap: 'wrap' }}>
              <Button size="sm" onClick={() => setEditing({ id: q.id, question: q.question, options: [...q.options], correctOption: q.correctOption, explanation: q.explanation ?? '', timeLimit: q.timeLimit, points: q.points })}>Edit</Button>
              <Button size="sm" variant="secondary" onClick={() => runAction(() => duplicateQuestion(quizId!, q))}>Duplicate</Button>
              <Button size="sm" variant="secondary" onClick={() => move(q, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
              <Button size="sm" variant="secondary" onClick={() => move(q, 1)} disabled={i === sorted.length - 1} aria-label="Move down">↓</Button>
              <Button size="sm" variant="danger" onClick={() => runAction(() => deleteQuestion(quizId!, q.id))}>Delete</Button>
            </div>
          </Card>
        ))
      )}

      {/* Question editor modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit question' : 'Add question'} wide>
        {editing && (
          <>
            <Input label="Question" name="q" value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} maxLength={300} />
            {editing.options.map((o, i) => (
              <div className="option-row" key={i}>
                <input
                  type="radio"
                  className="option-radio"
                  name="correct"
                  aria-label={`Mark option ${i + 1} correct`}
                  checked={editing.correctOption === i}
                  onChange={() => setEditing({ ...editing, correctOption: i })}
                />
                <Input
                  className="option-input"
                  name={`opt${i}`}
                  value={o}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => {
                    const options = [...editing.options];
                    options[i] = e.target.value;
                    setEditing({ ...editing, options });
                  }}
                />
                {editing.options.length > MIN_OPTIONS && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => {
                      const options = editing.options.filter((_, j) => j !== i);
                      let correct = editing.correctOption;
                      if (correct === i) correct = 0;
                      else if (correct > i) correct -= 1;
                      setEditing({ ...editing, options, correctOption: correct });
                    }}
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {editing.options.length < MAX_OPTIONS && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditing({ ...editing, options: [...editing.options, ''] })}
              >
                + Add option
              </Button>
            )}
            <Input label="Explanation (shown after the question)" name="explanation" value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} />
            <div className="grid grid-2">
              <Input label="Time limit (seconds)" name="timeLimit" type="number" min={5} max={120} value={editing.timeLimit} onChange={(e) => setEditing({ ...editing, timeLimit: clamp(Number(e.target.value) || 5, 5, 120) })} />
              <Input label="Points" name="points" type="number" min={10} max={1000} step={10} value={editing.points} onChange={(e) => setEditing({ ...editing, points: clamp(Number(e.target.value) || 10, 10, 1000) })} />
            </div>
            <div className="row mt-1">
              <Button onClick={saveQuestion} disabled={!editing.question.trim() || editing.options.map((o) => o.trim()).filter(Boolean).length < MIN_OPTIONS}>Save question</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Start-quiz pacing picker */}
      <StartQuizModal
        open={startOpen}
        onClose={() => { setStartOpen(false); setSp({}, { replace: true }); }}
        quizId={quizId!}
        published={published}
        questionCount={sorted.filter((q) => q.options.length >= 2).length}
        hasInvalidQuestions={sorted.some((q) => q.options.length < 2)}
      />
    </div>
  );
}

export function StartQuizModal({ open, onClose, quizId, published, questionCount, hasInvalidQuestions }: { open: boolean; onClose: () => void; quizId: string; published: boolean; questionCount: number; hasInvalidQuestions?: boolean }) {
  const [pacing, setPacing] = useState<Pacing>('classic');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<{ technical: string; hint: string } | null>(null);
  const nav = useNavigate();

  async function start() {
    // Busy-guard: a double-click used to create two sessions and the teacher
    // ended up hosting a different one than the PIN students joined.
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const { createGameSession } = await import('../../lib/gameService');
      const { sessionId } = await createGameSession(quizId, pacing);
      onClose();
      nav(`/teacher/sessions/${sessionId}`);
    } catch (e) {
      // Previously an unhandled rejection: the modal stayed open with no
      // feedback and the teacher couldn't tell if a session was created.
      setStartError(describeError(e, 'createQuizSession'));
      setStarting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="How should this quiz run?" wide>
      {startError && (
        <ErrorBanner
          title="Couldn't start the quiz"
          message="No session was created. You can try again — nothing is duplicated."
          technical={startError.technical}
          hint={startError.hint}
          onDismiss={() => setStartError(null)}
        />
      )}
      {!published && <p className="error-text">⚠ Publish this quiz first so students can join.</p>}
      {hasInvalidQuestions && <p className="error-text">⚠ Every question needs at least 2 non-empty options before you can host a live quiz.</p>}
      {questionCount === 0 && <p className="error-text">⚠ Add at least one question before starting.</p>}
      <div className="grid grid-2">
        {PACING_OPTIONS.map((p) => (
          <Card
            key={p.id}
            className={`mode-card ${pacing === p.id ? 'card-clickable' : ''}`}
            onClick={() => setPacing(p.id)}
          >
            <div style={{ borderRadius: 12, padding: 8 }}>
              <div className="mode-icon" aria-hidden="true">{p.icon}</div>
              <div className="mode-name">{p.name}</div>
              <div className="mode-tagline">{p.blurb}</div>
            </div>
          </Card>
        ))}
      </div>
      <p className="muted mt-2">
        {pacing === 'classic'
          ? 'You advance each question from this screen; students see one shared timer.'
          : 'Students get their own timer per question and move at their own speed; you watch their progress live.'}
      </p>
      <div className="row mt-1">
        <Button size="lg" variant="success" onClick={start} disabled={!published || questionCount === 0 || starting}>
          {starting ? 'Creating session…' : `Start ${pacing === 'classic' ? 'Classic' : 'Self-paced'} quiz`}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
