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

## Live sync (issues #385, #387, and #388)

The optional Firebase Realtime Database integration stores one versioned state
at `/board/state`: the normalized base FEN, current FEN, bounded space-delimited
SAN history, and a server timestamp. Receiving clients validate the exact shape,
replay SAN from the transmitted base, and require the reconstructed FEN to match
before replacing the local board. With the placeholder config checked in here,
the board remains local-only.

Firebase web configuration values are public project identifiers, **not secrets
or authorization controls**. Actual write authorization is enforced by
`rules.json`: reads are public, while writes require Firebase Authentication, an
administrator-managed `/admin/authorizedWriters/{uid}` entry, and the emergency
`/admin/writesEnabled` switch approved in #388. Both `/admin` values are denied
to browser clients and must be managed through the Firebase Console or a
separately controlled Admin SDK tool. Never commit service-account credentials.

Before deployment, run `npm run test:rules` in the canonical
`chess-prep-coaching-sync` repository, obtain independent security review, seed
the allowlist with only required writers, and leave `writesEnabled` false until
the tested rules are published. The client deliberately reports Local only,
Connecting, Synced, or Error instead of treating initialization as proof of a
working connection. Simultaneous valid writes remain last-write-wins.

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
