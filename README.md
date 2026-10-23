# The Haunted Hall of Fame

A live voting game for the Superside Town Hall. The host screen shows each award,
everyone votes on their phone, and the winner is revealed on the big screen.

- `/` is the phone voting page (the QR code points here)
- `/host?key=YOUR-KEY` is the host screen for the shared screen

Plain HTML, CSS and JavaScript. No build step.

## Set up (about 10 minutes)

### 1. Supabase (stores the votes)
1. Create a free project at [supabase.com](https://supabase.com).
2. Open `supabase.sql`, replace both `CHANGE-ME` values with a secret host key, and
   run it in **SQL Editor**.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
4. Paste them into `config.js`. The anon key is meant to be public; the host key
   stays secret inside the database.

### 2. GitHub
Push this folder to a new repository.

### 3. Vercel
1. **Add New → Project**, import the repository.
2. Framework preset: **Other**. No build command. Deploy.
3. Open `https://<your-app>.vercel.app/host?key=YOUR-KEY` on the presenting laptop.

## Running the game
- Lobby: people scan the QR code and pick their name.
- **Start the first award**, then **Close voting**, **Reveal the winner**, **Next award**.
  The right arrow key or space bar does the same, so a presentation clicker works too.
- After the last award, **Show all winners** displays the full recap.
- **Reset game** (on the lobby and recap screens) deletes all votes. Use it after a rehearsal.

## Editing content
- Teammates: `teammates.json`
- Awards: `awards.js`

## Local demo
With `config.js` empty, the app runs in demo mode in a single browser: open `/host`
and `/` in two tabs and they stay in sync.
