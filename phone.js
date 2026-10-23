import { AWARDS } from './awards.js';
import { store, tally, deviceId } from './store.js';
import { LOGO, esc, fold, initials, toast, loadTeammates, winnersOf } from './ui.js';

const app = document.getElementById('app');
const ME_KEY = 'hhof-me';

let me = localStorage.getItem(ME_KEY);
let teammates = [];
let game = null;
let selected = null;

async function header() {
  const who = me ? `<button class="me" data-action="change">Not ${esc(me.split(' ')[0])}? <u>Change name</u></button>` : '';
  return `<header class="phone-top"><span class="logo">${await LOGO}</span>${who}</header>`;
}

// A searchable list of names. `onPick` runs with the tapped name.
function pickList({ names, placeholder, cta, onSubmit }) {
  selected = null;
  app.insertAdjacentHTML('beforeend', `
    <div class="search"><input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off" enterkeyhint="search"></div>
    <ul class="people" aria-live="polite"></ul>
    <div class="dock"><button class="btn" data-action="submit" disabled>${esc(cta(null))}</button></div>`);

  const input = app.querySelector('.search input');
  const list = app.querySelector('.people');
  const submit = app.querySelector('[data-action="submit"]');

  const draw = () => {
    const q = fold(input.value.trim());
    const shown = names.filter((n) => fold(n).includes(q));
    list.innerHTML = shown.length
      ? shown.map((n) => `<li><button class="person" data-name="${esc(n)}" aria-pressed="${n === selected}">
          <span class="avatar" aria-hidden="true">${esc(initials(n))}</span>${esc(n)}<span class="check" aria-hidden="true"></span>
        </button></li>`).join('')
      : `<li class="empty">No one matches “${esc(input.value)}”. Try a first name.</li>`;
  };

  input.addEventListener('input', draw);
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.person');
    if (!btn) return;
    selected = btn.dataset.name;
    list.querySelectorAll('.person').forEach((b) => b.setAttribute('aria-pressed', b.dataset.name === selected));
    submit.disabled = false;
    submit.textContent = cta(selected);
  });
  submit.addEventListener('click', async () => {
    submit.disabled = true;
    try { await onSubmit(selected); } catch (e) { toast(`That didn’t go through. Check your connection and try again.`); submit.disabled = false; }
  });
  draw();
}

function stateView(glyph, title, text, extra = '') {
  app.insertAdjacentHTML('beforeend', `<section class="state">
    <div class="glyph" aria-hidden="true">${glyph}</div>
    <h1 class="serif">${title}</h1>
    <p>${text}</p>${extra}
  </section>`);
}

const cleanName = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 30);
const squash = (s) => fold(s).replace(/[^a-z]/g, '');

// Finds the teammate a typed first + last name belongs to, ignoring accents, case and spacing.
// "Elsa" + "Debruyn" → "Elsa De Bruyn", "Lucia" + "Damian" → "Lucia Damian Penin",
// "Nobu" + "Ngwane" → "Nobuhle Ngwane" (nickname, unique last name).
function matchTeammate(first, last) {
  const f = squash(first);
  const l = squash(last);
  if (l.length < 2) return teammates.find((t) => squash(t) === f + l) || null;
  const split = (t) => {
    const [tFirst, ...rest] = t.split(' ');
    return [squash(tFirst), squash(rest.join(''))];
  };
  const sameLast = teammates.filter((t) => {
    const tLast = split(t)[1];
    return tLast.startsWith(l) || tLast.endsWith(l);
  });
  return (
    teammates.find((t) => squash(t) === f + l) ||
    sameLast.find((t) => split(t)[0] === f) ||
    (sameLast.length === 1 && f.length >= 2 && split(sameLast[0])[0].startsWith(f.slice(0, 2)) ? sameLast[0] : null)
  );
}

async function renderJoin() {
  app.innerHTML = await header();
  app.insertAdjacentHTML('beforeend', `<form class="join" novalidate>
    <p class="kicker">The Haunted Hall of Fame</p>
    <h1 class="serif">What’s your name?</h1>
    <p class="sub">Join with your first and last name. You’ll vote for a teammate on each award.</p>
    <label class="field">
      <span>First name</span>
      <input name="first" type="text" required maxlength="30" autocomplete="given-name" autocapitalize="words" enterkeyhint="next">
    </label>
    <label class="field">
      <span>Last name</span>
      <input name="last" type="text" required maxlength="30" autocomplete="family-name" autocapitalize="words" enterkeyhint="go">
    </label>
    <div class="dock"><button class="btn" type="submit" disabled>Join the game</button></div>
  </form>`);

  const form = app.querySelector('.join');
  const [firstInput, lastInput] = form.querySelectorAll('input');
  const submit = form.querySelector('button');
  const valid = () => squash(firstInput.value).length >= 1 && squash(lastInput.value).length >= 1;
  form.addEventListener('input', () => (submit.disabled = !valid()));
  firstInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); lastInput.focus(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!valid()) return (squash(firstInput.value) ? lastInput : firstInput).focus();
    const first = cleanName(firstInput.value);
    const last = cleanName(lastInput.value);
    // Use the list's spelling when we recognise the person, otherwise keep what they typed.
    const name = matchTeammate(first, last) || `${first} ${last}`;
    submit.disabled = true;
    submit.textContent = 'Joining…';
    try {
      await store.join(deviceId(), name);
      me = name;
      localStorage.setItem(ME_KEY, name);
      render();
    } catch {
      toast('That didn’t go through. Check your connection and try again.');
      submit.disabled = false;
      submit.textContent = 'Join the game';
    }
  });
}

async function render() {
  if (!me) return renderJoin();
  if (!game) return;
  const { award_index: i, status } = game;
  const award = AWARDS[i];
  app.innerHTML = await header();

  if (status === 'lobby') {
    return stateView('🕯️', `You’re in, ${esc(me.split(' ')[0])}.`, 'The first award will show up here as soon as the host starts. Keep this page open.');
  }

  if (status === 'voting') {
    const mine = await store.myVote(i, deviceId());
    if (mine) {
      return stateView('🎃', 'Vote locked in.', `You voted for <b>${esc(mine)}</b>. The next award appears here when the host moves on.`);
    }
    app.insertAdjacentHTML('beforeend', `<section>
      <p class="kicker">Award ${i + 1} of ${AWARDS.length}</p>
      <h1 class="serif">${esc(award.name)} Award</h1>
      <p class="sub">${esc(award.tagline)}</p>
    </section>`);
    return pickList({
      names: teammates.filter((n) => n !== me), // `me` uses the list's spelling when we matched you on join
      placeholder: 'Search a teammate',
      cta: (n) => (n ? `Vote for ${n}` : 'Pick a teammate'),
      onSubmit: async (nominee) => {
        const result = await store.vote(i, deviceId(), nominee);
        if (result === 'duplicate') toast('You already voted for this award.');
        if (result === 'closed') toast('Voting for this award just closed.');
        render();
      },
    });
  }

  if (status === 'closed') {
    return stateView('🦇', 'Voting is closed.', 'Eyes on the big screen. The winner is about to be revealed.');
  }

  if (status === 'revealed') {
    const w = winnersOf(tally(await store.votes(i)));
    return stateView('🏆', `${esc(award.name)} Award`, 'And the winner is…',
      `<div class="winner-line"><b>${w.length ? w.map(esc).join(' & ') : 'No votes'}</b></div>`);
  }

  if (status === 'finished') {
    return stateView('👻', 'That’s a wrap.', 'Thanks for voting in the Haunted Hall of Fame. See you at the next Town Hall.');
  }
}

app.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="change"]')) {
    me = null;
    localStorage.removeItem(ME_KEY);
    render();
  }
});

teammates = await loadTeammates();
if (me) store.join(deviceId(), me).catch(() => {}); // re-register a remembered name, e.g. after a reset
store.onGame((g) => {
  const changed = !game || g.award_index !== game.award_index || g.status !== game.status;
  game = g;
  // A reset clears the player list, so rejoin when the game goes back to the lobby.
  if (changed && me && g.status === 'lobby') store.join(deviceId(), me).catch(() => {});
  if (changed && me) render();
});
if (!me) render();
