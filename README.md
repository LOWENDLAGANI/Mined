# ⛏️ Mined — Learn. Play. Level Up.

Mined is a multiplayer, gamified classroom learning and quiz platform. Teachers build quizzes, choose one of **7 game modes**, and run live games with a short game code. Students join, play in real time, and earn **XP, levels, streaks, achievements and rankings**.

> Turn learning into a game.

---

## Features

- **Roles**: Teacher & Student accounts — role stored server-side in Firestore, enforced by security rules (not client state)
- **Quiz system**: reusable quizzes with questions, options, explanations, timers, points, reordering, duplicate/publish/delete
- **7 game modes**: Classic, Race, Battle, Boss Battle, Treasure Hunt, Survival, Team Battle — *one quiz can be played in any mode without duplication* (QUIZ DATA ≠ GAME MODE)
- **Live multiplayer**: 5-character game codes, real-time lobby, synchronized server timers, live standings
- **Server-authoritative scoring**: correctness, response time, speed bonuses, streaks, XP and progression are computed in Cloud Functions — never the client
- **Progression**: XP, levels, day-streaks, 8 achievements, global/weekly leaderboards
- **Analytics**: per-question correct %, average response time, hardest/easiest questions, class rankings
- **Replaceable art**: all textures flow through a single asset config (`src/assets/textures.ts`) with named slots matching the `texture_*` naming convention

## Tech stack

- **Frontend**: Vite + React 18 + TypeScript + React Router
- **Backend**: Firebase Auth (email/password + Google), Cloud Firestore, Firebase Storage, Cloud Functions (Node 20), callable functions for all trusted operations

---

## Project structure

```
src/
  assets/            textures.ts (asset slots) + avatars.ts
  auth/              AuthContext, protected routes (role verified from Firestore)
  components/        Logo, Layout, UI primitives
  lib/               firebase.ts, types.ts, scoring.ts, gameModes.ts,
                     firestore.ts, gameService.ts, format.ts
  pages/             Landing, RoleSelect, Register, Login, ForgotPassword, Join,
                     Settings, NotFound
    teacher/         Dashboard, Quizzes, QuizEditor, Games, GameLobby, Results,
                     GameResultsTeacher, TeacherProfile
    student/         Home, Progress, Achievements, Leaderboard, StudentProfile,
                     StudentGame (live gameplay + mode HUDs), GameResultsStudent
functions/
  src/index.ts       createGameSession, joinGame, startGame, advanceQuestion,
                     submitAnswer, finishGame, removePlayer, setJoinLock, leaveGame,
                     ensureProfile
firestore.rules      strict role/ownership rules
storage.rules        per-user and per-quiz write scopes
```

---

## Firebase setup (from zero)

### 1. Create the Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**.
2. Name it (e.g. `mined-prod`) and follow the wizard (Analytics optional).

### 2. Register a Web app
1. In Project settings → **General** → **Your apps** → click the **`</>`** (Web) icon.
2. Register the app (no hosting needed yet).
3. Copy the `firebaseConfig` values — you'll paste them into `.env` in step 9.

### 3. Enable Authentication
1. **Build → Authentication → Get started**.
2. Enable **Email/Password**.
3. (Optional) Enable **Google** under Sign-in method, and add your domain under **Authorized domains** (localhost is there by default).

### 4. Create the Firestore database
1. **Build → Firestore Database → Create database**.
2. Choose **Production mode** (the rules in this repo are stricter and will be deployed next).
3. Pick a region close to your users.

### 5. Create the Storage bucket
1. **Build → Storage → Get started** → accept the default bucket and region.

### 6. Deploy Firestore Security Rules
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # select your project
firebase deploy --only firestore:rules
```

### 7. Deploy Storage Rules
```bash
firebase deploy --only storage
```

### 8. Deploy Firestore indexes
```bash
firebase deploy --only firestore:indexes
```

### 9. Add environment variables
Copy the example file and fill in the values from step 2:

```bash
cp .env.example .env
```

```ini
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=......VITE_FIREBASE_MESSAGING_SENDER_ID=......
VITE_FIREBASE_APP_ID=...
```

> ⚠️ Never commit `.env`. It's already in `.gitignore`.

### 10. Configure & deploy Cloud Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Cloud Functions are the trusted backend. They handle: unique game-code generation, join validation, session lifecycle/state machine, answer correctness & timing, scoring, speed bonuses, streaks, XP, level-ups, win detection, achievements, and result records. **The client never computes or submits scores.**

### 11. Run the app
```bash
npm install
npm run dev          # http://localhost:5173
```

Production build & hosting:
```bash
npm run build
firebase deploy --only hosting
```

### Optional: local emulation
```bash
firebase emulators:start
```
The emulator suite (Auth/Firestore/Functions/Storage) is pre-configured in `firebase.json`. For the web app to hit emulators, see the Firebase docs on `connectAuthEmulator` / `connectFirestoreEmulator`.

---

## How a game runs

1. **Teacher**: Dashboard → Create Quiz → add questions → Publish → Start Game → choose a mode → `createGameSession` returns a code like `7K4P2`.
2. **Students**: `/join` → enter code → `joinGame` validates session state, adds them to the lobby.
3. **Teacher lobby**: shows the code and players joining in real time; Start → countdown → questions open server-side with synchronized deadlines.
4. **Students**: see the question, submit an answer via the `submitAnswer` callable; the server computes correctness, response time, score, streak and XP, and applies mode effects (race movement, boss damage, coins, lives).
5. **End**: teacher finishes (or the last question closes) → `finishGame` ranks players, awards completion/win XP, updates day-streaks, unlocks achievements, and writes `gameResults`.
6. **Analytics**: teacher opens Results for per-question performance and class rankings.

## Game state machine

```
WAITING → COUNTDOWN → QUESTION_ACTIVE ⇄ QUESTION_RESULTS → … → FINISHED
```
Transitions are enforced in Cloud Functions; invalid transitions (e.g. WAITING → FINISHED except by explicit teacher end action) are rejected.

## Security notes

- Roles live in Firestore and can't be changed by clients (rules reject `role` changes).
- XP, level, streaks, scores, achievements and game state are only writable by Cloud Functions.
- Students can only submit answers through the callable while a question is active; duplicate submissions are blocked by deterministic answer doc IDs (`{uid}_{questionId}`) and transactions.
- Answer keys are never sent to students during play — the client renders options only; correctness is revealed after submission/deadline.
- This significantly raises the bar against casual cheating, but no client-side system is completely cheat-proof.

## Replacing placeholder art

All textures are slots in `src/assets/textures.ts` (`texture_background`, `texture_panel`, `texture_card`, `texture_button`, `texture_header`, `texture_game_background`, `texture_race_track`, `texture_boss_arena`, `texture_treasure_map`, `texture_modal`). Drop in a real image URL/import per slot and every screen picks it up — no component edits. Upload assets provided under the `texture_*` naming convention and they map 1:1 to these slots.
