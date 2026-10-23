import { AWARDS } from './awards.js';
import { store, tally } from './store.js';
import { LOGO, esc, fold, initials, toast, loadTeammates, winnersOf } from './ui.js';

const app = document.getElementById('app');
const ME_KEY = 'hhof-me';

let me = localStorage.getItem(ME_KEY);
let teammates = [];
let game = null;
let selected = null;

async function header() {
  const who = me ? `<button class="me" data-action="change">Voting as <u>${esc(me)}</u></button>` : '';
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

async function renderJoin() {
  app.innerHTML = await header();
  app.insertAdjacentHTML('beforeend', `<section>
    <p class="kicker">The Haunted Hall of Fame</p>
    <h1 class="serif">Who are you?</h1>
    <p class="sub">Find your name so we can count your vote. You won’t be able to vote for yourself.</p>
  </section>`);
  pickList({
    names: teammates,
    placeholder: 'Search your name',
    cta: (n) => (n ? `Continue as ${n}` : 'Select your name'),
    onSubmit: async (name) => {
      await store.join(name);
      me = name;
      localStorage.setItem(ME_KEY, name);
      render();
    },
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
    const mine = await store.myVote(i, me);
    if (mine) {
      return stateView('🎃', 'Vote locked in.', `You voted for <b>${esc(mine)}</b>. The next award appears here when the host moves on.`);
    }
    app.insertAdjacentHTML('beforeend', `<section>
      <p class="kicker">Award ${i + 1} of ${AWARDS.length}</p>
      <h1 class="serif">${esc(award.name)} Award</h1>
      <p class="sub">${esc(award.tagline)}</p>
    </section>`);
    return pickList({
      names: teammates.filter((n) => n !== me),
      placeholder: 'Search a teammate',
      cta: (n) => (n ? `Vote for ${n}` : 'Pick a teammate'),
      onSubmit: async (nominee) => {
        const result = await store.vote(i, me, nominee);
        if (result === 'duplicate') toast('You already voted for this award.');
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
store.onGame((g) => {
  const changed = !game || g.award_index !== game.award_index || g.status !== game.status;
  game = g;
  if (changed && me) render();
});
if (!me) render();
