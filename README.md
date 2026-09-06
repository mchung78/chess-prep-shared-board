# chess-prep-shared-board

A standalone, publicly-hosted copy of the shared interactive chess board used
during live chess-coaching sessions (see the `chess-prep` and
`chess-prep-coaching-sync` repos).

Canonical source for the board lives in
`mchung78-agent/chess-prep-coaching-sync` at
`skills/chess-coach/assets/board.html`, where it's also used as the
chess-coach Skill's inline artifact. This repo exists solely so the same
board can be served as a durable, sign-in-free URL via GitHub Pages, since
Pages requires a public repo on GitHub's Free plan.

**Never hand-edit `board.html` here.** After changing the canonical copy,
run `skills/chess-coach/scripts/sync_shared_board.py` (in the
coaching-sync repo) to push it here - one command instead of a manual
copy that's easy to forget (this is exactly what happened once already:
a Codex review of issue #381 flagged the two-copies-with-no-sync-process
gap before this script existed).

No coaching data, credentials, or personal information lives here or ever
should - this repo holds only the generic board UI. If a future change to
`board.html` adds anything sensitive, it must not be copied here.

Live: https://mchung78.github.io/chess-prep-shared-board/board.html

## Live sync (issue #385)

The board optionally syncs its state (current FEN + move list) live across
every open viewer via a single Firebase Realtime Database node, so two
people looking at the board see the same position update in real time
with no reload. Deliberately evaluated *before* Render/Neon (TASK_120) for
this specific need - see #385 for why. Without a Firebase project
configured, the board still works fine as a local-only tool for a single
viewer.

### Setup

1. Create a Firebase project at <https://console.firebase.google.com/>
   (Google Analytics not needed - skip it).
2. In the project: Build → Realtime Database → Create Database.
   Start in **locked mode** - the rules below replace the default, so
   locked-vs-test-mode doesn't matter once they're applied.
3. Paste the contents of `rules.json` (this repo's root) into
   Realtime Database → Rules, and publish.
4. Register a **Web app** (Project settings → your apps → `</>`) to get
   a config object (`apiKey`, `authDomain`, `databaseURL`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`).
5. Paste that config object into `board.html`'s `firebaseConfig`
   placeholder, replacing every `REPLACE_ME`, in the canonical source
   (`chess-prep-coaching-sync`), then run `sync_shared_board.py` to push
   it here.

### What's actually secret here (and what isn't)

The `firebaseConfig` values in `board.html` are **not secrets** -
they identify the Firebase project, they don't grant privileged access,
and Google's own docs say as much. It's fine for them to sit in a public
repo's client-side JS. The real access gate is `rules.json`: it restricts
the database to a single `board` node, requires exactly the fields
`fen`/`moves`/`updatedAt`, and bounds each field's size, precisely so that
having the (also public) config values doesn't let anyone write arbitrary
data. If you ever change the rules, keep that property - don't loosen
validation just because "the config is public anyway."

### Design notes

- **Single shared board, no auth.** Access is "you have the board's URL,"
  matching how the board's Pages hosting already works. Revisit only if
  a second board/room is ever actually needed (see #382).
- **Last-write-wins.** If two people move at nearly the same instant, one
  write simply overwrites the other. Fine for a single low-stakes board;
  stated here explicitly rather than left as an accident.
- **Move list, not just FEN, is synced**, so other viewers get the real
  move history (and correct turn/undo state), not just a static final
  position - see the comment above `pushSharedState()` in `board.html`.

### Vendored dependencies

`chess.js` 0.10.3 is embedded inline in `board.html` rather than loaded
from the cdnjs CDN - works identically whether this file runs as a
claude.ai artifact widget or a standalone Pages site, with no runtime
dependency on a third party and no visit-leakage to it. If a newer
chess.js version is ever wanted, re-vendor it the same way rather than
switching back to a `<script src>` CDN reference. The Firebase SDK above
is *not* vendored the same way - it's large, and it's a first-party CDN
for the exact service this file already depends on, so inlining it would
just bloat the file for no real benefit.
