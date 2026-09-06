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

No coaching data, credentials, or personal information lives here or ever
should - this repo holds only the generic board UI. If a future change to
`board.html` adds anything sensitive, it must not be copied here.

Live: https://mchung78.github.io/chess-prep-shared-board/board.html
