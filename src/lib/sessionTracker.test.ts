// Unit tests for the session resume tracker (run with: bun test).
import { describe, it, expect, beforeEach } from 'bun:test';
import { saveActiveSession, getActiveSession, clearActiveSession } from './sessionTracker';

// Bun's test runtime has no DOM, so polyfill a minimal in-memory localStorage.
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  },
});

const SAMPLE = { sessionId: 'sess_abc123', quizTitle: 'Matematik Bab 2', pin: '7K4P2' };

describe('sessionTracker', () => {
  beforeEach(() => {
    store.clear();
  });

  it('saves and reads back an active session', () => {
    saveActiveSession(SAMPLE);
    const got = getActiveSession();
    expect(got).not.toBeNull();
    expect(got!.sessionId).toBe(SAMPLE.sessionId);
    expect(got!.quizTitle).toBe(SAMPLE.quizTitle);
    expect(got!.pin).toBe(SAMPLE.pin);
    expect(typeof got!.savedAt).toBe('string');
    expect(Number.isNaN(Date.parse(got!.savedAt))).toBe(false);
  });

  it('returns null when nothing was saved', () => {
    expect(getActiveSession()).toBeNull();
  });

  it('overwrites a previous session (one active session at a time)', () => {
    saveActiveSession(SAMPLE);
    saveActiveSession({ ...SAMPLE, sessionId: 'sess_999', pin: 'ABCDE' });
    const got = getActiveSession();
    expect(got!.sessionId).toBe('sess_999');
    expect(got!.pin).toBe('ABCDE');
  });

  it('clears the tracked session', () => {
    saveActiveSession(SAMPLE);
    clearActiveSession();
    expect(getActiveSession()).toBeNull();
  });

  it('clear is safe to call twice', () => {
    clearActiveSession();
    clearActiveSession();
    expect(getActiveSession()).toBeNull();
  });

  it('returns null when localStorage holds malformed JSON', () => {
    store.set('mined.activeSession', '{not valid json');
    expect(getActiveSession()).toBeNull();
  });

  it('returns null when localStorage holds an object without sessionId', () => {
    store.set('mined.activeSession', JSON.stringify({ quizTitle: 'no id' }));
    expect(getActiveSession()).toBeNull();
  });
});
