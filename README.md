# The Haunted Hall of Fame

A live voting game for the Superside Town Hall.

- **`/`** is the presenter screen. Share it in the meeting: it shows each award, the
  QR code, the live vote count and the winner reveal.
- **`/play`** is the phone voting page. The QR code points here.

Plain HTML, CSS and JavaScript, no build step. Hosted on Vercel, votes stored in Supabase.

## Running the game
- Open the main link and share your screen. People scan the QR code and pick their name.
- **Start the first award**, then **Close voting**, **Reveal the winner**, **Next award**.
  The right arrow key or space bar does the same, so a presentation clicker works too.
- After the last award, **Show all winners** displays the full recap.
- **Reset game** (on the lobby and recap screens) deletes all votes. Use it after a rehearsal.

## Editing content
- Teammates: `teammates.json`
- Awards: `awards.js`

Changes pushed to GitHub redeploy on Vercel automatically.

## Setup reference
- `supabase.sql` creates the database tables (run once in Supabase's SQL Editor).
- `config.js` holds the Supabase project URL and the anon public key. Leave them
  empty to run a local demo where two browser tabs stay in sync.
