# The Haunted Hall of Fame

A live voting game for the Superside Town Hall.

- **`/`** is the presenter screen. Share it in the meeting: it shows each award, the
  QR code, the live vote count and the winner reveal.
- **`/play`** is the phone voting page. The QR code points here.

Plain HTML, CSS and JavaScript, no build step. Hosted on Vercel, votes stored in Supabase.

## Running the game
- Open the main link and share your screen. People scan the QR code and type their
  first and last name. Names are matched to `teammates.json` (accents, capitals and
  common nicknames don't matter), so nobody can vote for themselves.
- **Start the first award**, then **Close voting**, **Reveal the winner**, **Next award**.
  The right arrow key, space bar or a presentation clicker does the same. Double presses
  are ignored, so you can't skip an award by accident.
- Closed voting too early? **Reopen voting** on the "Voting closed" screen.
- **Reset game** is on every screen. It asks first, then deletes all votes and sends
  everyone back to the lobby (phones rejoin by themselves).
- Refreshing the presenter screen is safe: it picks up exactly where you were.
- Votes belong to the phone, not the typed name: one vote per phone per award.
- Add `?demo` to either link to rehearse in one browser without touching the real votes.

## Editing content
- Teammates: `teammates.json`
- Awards: `awards.js`

Changes pushed to GitHub redeploy on Vercel automatically.

## Setup reference
- `supabase.sql` creates the database tables (run once in Supabase's SQL Editor).
- `config.js` holds the Supabase project URL and the anon public key. Leave them
  empty to run a local demo where two browser tabs stay in sync.
