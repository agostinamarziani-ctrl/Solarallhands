import { AWARDS } from './awards.js';
import { store, tally } from './store.js';
import { LOGO, esc, toast, winnersOf } from './ui.js';

const app = document.getElementById('app');
const joinUrl = location.origin + '/play';

let game = null;
let primary = null; // the main action for the current state, also bound to → / space / clicker
let pollTimer = null;
let renderSeq = 0;
let liveVotes = { award: null, count: 0 }; // last count seen while voting was open

let saving = Promise.resolve(); // the latest step being saved to the database

// Votes for one award, fetched once the database has confirmed voting is closed
// (so no late vote is missed) and kept so the reveal is instant.
let finalVotes = { award: null, promise: null };
function loadFinalVotes(i) {
  if (finalVotes.award !== i) {
    finalVotes = { award: i, promise: saving.catch(() => {}).then(() => store.votes(i)) };
  }
  return finalVotes.promise;
}
let allVotes = null; // prefetched for the finale during the last reveal

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
const votesAreIn = (n) => `${n} ${n === 1 ? 'vote is' : 'votes are'} in. Who will it be?`;
const names = (list) => (list.length ? list.map(esc).join(' &amp; ') : 'No votes');

async function render() {
  const seq = ++renderSeq;
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
      `<span class="live-dot"></span><span data-joined-label>Waiting for people to join</span>`,
      `<button class="btn" data-action="start">Start the first award</button>`
    );
    primary = () => go(0, 'voting');
  }

  if (status === 'voting') {
    finalVotes = { award: null, promise: null }; // reopened voting means new votes can arrive
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
       <span><b data-votes>${liveVotes.award === i ? liveVotes.count : 0}</b> of <span data-joined>0</span> voted</span>`,
      `<button class="btn" data-action="close">Close voting</button>`
    );
    primary = () => go(i, 'closed');
  }

  if (status === 'closed') {
    // Show the last count we saw straight away, then correct it once the final tally arrives.
    const seen = liveVotes.award === i ? liveVotes.count : null;
    body = `<main class="suspense">
      <p class="award-count">${countLabel(i)}</p>
      <h2 class="serif">${esc(award.name)} Award</h2>
      <p data-final>${seen == null ? 'Counting the votes…' : votesAreIn(seen)}</p>
    </main>`;
    footer = bar(
      `<span>Voting closed</span>`,
      `<button class="btn ghost" data-action="reopen">Reopen voting</button>
       <button class="btn" data-action="reveal">Reveal the winner</button>`
    );
    primary = () => go(i, 'revealed');
    loadFinalVotes(i).then((v) => {
      const el = seq === renderSeq && app.querySelector('[data-final]');
      if (el) el.textContent = votesAreIn(v.length);
    }).catch(() => {});
  }

  if (status === 'revealed') {
    const results = tally(await loadFinalVotes(i));
    const winners = winnersOf(results);
    const last = i === AWARDS.length - 1;
    if (last) allVotes = store.votes();
    const podium = results.slice(0, 3).map((r, n) =>
      `<div class="${n === 0 ? 'first' : ''}"><b>${esc(r.name)}</b><span>${r.count} ${r.count === 1 ? 'vote' : 'votes'}</span></div>`
    ).join('');
    body = `<main class="reveal">
      <p class="for"><span class="serif">${esc(award.name)}</span> Award goes to</p>
      <h1 class="winner serif">${winners.length > 1 ? '<span class="tie">It’s a tie</span>' : ''}${names(winners)}</h1>
      <div class="podium">${podium}</div>
    </main>`;
    footer = bar(
      `<span>${countLabel(i)}</span>`,
      `<button class="btn" data-action="next">${last ? 'Show all winners' : 'Next award'}</button>`
    );
    primary = () => (last ? go(i, 'finished') : go(i + 1, 'voting'));
  }

  if (status === 'finished') {
    const all = await (allVotes || store.votes());
    const arches = AWARDS.map((a, n) => {
      const w = winnersOf(tally(all.filter((v) => v.award_id === n)));
      return `<li class="arch" style="--i:${n}">
        <span class="arch-icon" aria-hidden="true">${a.icon}</span>
        <b class="arch-name serif">${names(w)}</b>
        <span class="arch-award">${esc(a.name)} Award</span>
      </li>`;
    }).join('');
    body = `<main class="finale">
      <header class="finale-head">
        <h2 class="serif">The spirits have spoken.</h2>
        <p>Ten superpowers. Ten legends. Their names now haunt these halls forever.</p>
      </header>
      <ol class="hall">${arches}</ol>
    </main>`;
    footer = bar(`<span>Thanks for voting, and happy Halloween</span>`, '');
    primary = null;
  }

  if (seq !== renderSeq) return; // a newer state arrived while this one was loading
  app.innerHTML = header + body + footer;

  if (status === 'lobby' || status === 'voting') {
    const refresh = async () => {
      const [joined, votes] = await Promise.all([store.countPlayers(), status === 'voting' ? store.votes(i) : []]);
      if (seq !== renderSeq) return;
      if (status === 'voting') liveVotes = { award: i, count: votes.length };
      app.querySelectorAll('[data-joined]').forEach((el) => (el.textContent = joined));
      const label = app.querySelector('[data-joined-label]');
      if (label) label.innerHTML = joined ? `<b>${joined}</b> ${joined === 1 ? 'person has' : 'people have'} joined` : 'Waiting for people to join';
      const v = app.querySelector('[data-votes]');
      if (v) v.textContent = votes.length;
      const m = app.querySelector('[data-meter]');
      if (m) m.style.width = `${joined ? Math.min(100, (votes.length / joined) * 100) : 0}%`;
    };
    refresh().catch(() => {});
    pollTimer = setInterval(() => refresh().catch(() => {}), 2000);
  }
}

let busy = false; // ignores double clicks / clicker double-presses while a step is saving
let ignoreRemoteUntil = 0; // stops an in-flight poll from briefly undoing a click

// Changes the big screen immediately, then saves. If saving fails, goes back and says so.
async function go(index, status) {
  if (busy) return;
  busy = true;
  const previous = game;
  ignoreRemoteUntil = Date.now() + 3000;
  saving = store.setGame(index, status);
  apply({ award_index: index, status });
  try {
    await saving;
  } catch {
    ignoreRemoteUntil = 0;
    apply(previous);
    toast('Couldn’t reach the server, so nothing changed. Check the Wi-Fi and click again.');
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
      liveVotes = { award: null, count: 0 };
      finalVotes = { award: null, promise: null };
      allVotes = null;
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

store.onGame((g) => {
  if (busy || Date.now() < ignoreRemoteUntil) return;
  apply(g);
});
