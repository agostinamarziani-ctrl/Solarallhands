import { AWARDS } from './awards.js';
import { store, tally } from './store.js';
import { LOGO, esc, toast, winnersOf } from './ui.js';

const app = document.getElementById('app');
const joinUrl = location.origin + '/play';

let game = null;
let primary = null; // the main action for the current state, also bound to → / space
let pollTimer = null;

function qrSvg() {
  const qr = qrcode(0, 'M');
  qr.addData(joinUrl);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true }).replace(/black/g, '#0a211f');
}

function joinCard() {
  return `<div class="join-card">
    <div class="qr">${qrSvg()}</div>
    <p>Scan to vote</p>
    <p class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</p>
  </div>`;
}

async function top() {
  return `<header class="host-top">
    <span class="logo">${await LOGO}</span>
    <span class="event">The Haunted Hall of Fame</span>
  </header>`;
}

function bar(status, buttons) {
  return `<footer class="host-bar">
    <div class="status">${status}</div>
    <div class="controls">
      <button class="btn ghost reset" data-action="reset">Reset game</button>
      ${buttons}
    </div>
  </footer>`;
}

const countLabel = (i) => `Award ${i + 1} of ${AWARDS.length}`;

async function render() {
  clearInterval(pollTimer);
  const { award_index: i, status } = game;
  const award = AWARDS[i];
  const header = await top();
  let body = '';
  let footer = '';

  if (status === 'lobby') {
    body = `<main class="lobby">
      <div>
        <h1 class="serif">The Haunted Hall of Fame</h1>
        <p class="lede">Ten awards for the superpowers on our team. Scan the code to join, then vote for a teammate on each one.</p>
      </div>
      ${joinCard()}
    </main>`;
    footer = bar(
      `<span class="live-dot"></span><span><b data-joined>0</b> people have joined</span>`,
      `<button class="btn" data-action="start">Start the first award</button>`
    );
    primary = () => go(0, 'voting');
  }

  if (status === 'voting') {
    body = `<main class="host-main">
      <section>
        <p class="award-count">${countLabel(i)}</p>
        <h1 class="award-name serif">${esc(award.name)} Award</h1>
        <p class="superpower">Superpower: <b>${esc(award.superpower)}</b></p>
        <p class="tagline">${esc(award.tagline)}</p>
        <p class="description">${esc(award.description)}</p>
      </section>
      ${joinCard()}
    </main>`;
    footer = bar(
      `<span class="live-dot"></span><span>Voting is open</span>
       <span class="meter"><i data-meter style="width:0"></i></span>
       <span><b data-votes>0</b> of <span data-joined>0</span> people voted</span>`,
      `<button class="btn" data-action="close">Close voting</button>`
    );
    primary = () => go(i, 'closed');
  }

  if (status === 'closed') {
    const n = (await store.votes(i)).length;
    body = `<main class="suspense">
      <p class="award-count">${countLabel(i)}</p>
      <h2 class="serif">${esc(award.name)} Award</h2>
      <p>${n} ${n === 1 ? 'vote is' : 'votes are'} in. Who will it be?</p>
    </main>`;
    footer = bar(
      `<span>Voting closed</span>`,
      `<button class="btn ghost" data-action="reopen">Reopen voting</button>
       <button class="btn" data-action="reveal">Reveal the winner</button>`
    );
    primary = () => go(i, 'revealed');
  }

  if (status === 'revealed') {
    const results = tally(await store.votes(i));
    const winners = winnersOf(results);
    const last = i === AWARDS.length - 1;
    const name = winners.length ? winners.map(esc).join(' &amp; ') : 'No votes yet';
    const podium = results.slice(0, 3).map((r, n) =>
      `<div class="${n === 0 ? 'first' : ''}"><b>${esc(r.name)}</b><span>${r.count} ${r.count === 1 ? 'vote' : 'votes'}</span></div>`
    ).join('');
    body = `<main class="reveal">
      <p class="for"><span class="serif">${esc(award.name)}</span> Award goes to</p>
      <h1 class="winner serif">${winners.length > 1 ? '<span class="tie">It’s a tie</span>' : ''}${name}</h1>
      <div class="podium">${podium}</div>
    </main>`;
    footer = bar(
      `<span>${countLabel(i)}</span>`,
      `<button class="btn" data-action="next">${last ? 'Show all winners' : 'Next award'}</button>`
    );
    primary = () => (last ? go(i, 'finished') : go(i + 1, 'voting'));
  }

  if (status === 'finished') {
    const all = await store.votes();
    const rows = AWARDS.map((a, n) => {
      const w = winnersOf(tally(all.filter((v) => v.award_id === n)));
      return `<li><span>${esc(a.name)}</span><b>${w.length ? w.map(esc).join(' &amp; ') : '—'}</b></li>`;
    }).join('');
    body = `<main class="recap">
      <h2 class="serif">Your Haunted Hall of Fame</h2>
      <ol>${rows}</ol>
    </main>`;
    footer = bar(`<span>Thanks for voting</span>`, '');
    primary = null;
  }

  app.innerHTML = header + body + footer;

  if (status === 'lobby' || status === 'voting') {
    const refresh = async () => {
      const [joined, votes] = await Promise.all([store.countPlayers(), status === 'voting' ? store.votes(i) : []]);
      app.querySelectorAll('[data-joined]').forEach((el) => (el.textContent = joined));
      const v = app.querySelector('[data-votes]');
      if (v) v.textContent = votes.length;
      const m = app.querySelector('[data-meter]');
      if (m) m.style.width = `${joined ? Math.min(100, (votes.length / joined) * 100) : 0}%`;
    };
    refresh();
    pollTimer = setInterval(refresh, 2000);
  }
}

let busy = false; // ignores double clicks / clicker double-presses while a step is saving

async function go(index, status) {
  if (busy) return;
  busy = true;
  try {
    await store.setGame(index, status);
    apply({ award_index: index, status }); // don't wait for the round trip to update the big screen
  } catch (e) {
    toast('Couldn’t reach the server. Check the Wi-Fi and click again.');
  } finally {
    busy = false;
  }
}

app.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'reset') {
    if (!confirm('Reset the game? This deletes every vote and sends everyone back to the start.')) return;
    try {
      await store.resetGame();
      game = null;
      apply({ award_index: -1, status: 'lobby' });
    } catch {
      toast('Couldn’t reset. Check the Wi-Fi and try again.');
    }
    return;
  }
  if (action === 'reopen') return go(game.award_index, 'voting');
  primary?.();
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') && primary && !e.target.closest?.('button')) {
    e.preventDefault();
    primary();
  }
});

function apply(g) {
  if (game && g.award_index === game.award_index && g.status === game.status) return;
  game = g;
  render();
}

store.onGame(apply);
