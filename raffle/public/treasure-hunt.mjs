const designs = 20;
const copiesPerDesign = 1000;
const holdingLimit = 50;
const storageKey = 'house-arcade:treasure-hunt:1';

export function newHunt() {
  return {pool:Array(designs).fill(copiesPerDesign), held:Array(designs).fill(0), claimed:false};
}

export function summarize({held, claimed}) {
  const unique = held.filter(Boolean).length;
  const total = held.reduce((sum, count) => sum + count, 0);
  return {unique, total, canDraw:!claimed && unique < designs && total < holdingLimit,
    canTrade:!claimed && unique < designs && total > unique, canClaim:!claimed && unique === designs};
}

export function drawPiece(hunt, pick) {
  if (!summarize(hunt).canDraw) return null;
  const missing = hunt.held.flatMap((count, index) => count === 0 && hunt.pool[index] > 0 ? [index] : []);
  if (!missing.length) return null;
  const index = missing[pick(missing.length)];
  hunt.pool[index]--;
  hunt.held[index]++;
  return index + 1;
}

export function tradePiece(hunt, pick) {
  if (!summarize(hunt).canTrade) return null;
  const missing = hunt.held.flatMap((count, index) => count === 0 && hunt.pool[index] > 0 ? [index] : []);
  if (!missing.length) return null;
  const outgoing = hunt.held.findIndex(count => count > 1);
  const incoming = missing[pick(missing.length)];
  hunt.held[outgoing]--;
  hunt.pool[outgoing]++;
  hunt.held[incoming]++;
  hunt.pool[incoming]--;
  return {outgoing:outgoing + 1, incoming:incoming + 1};
}

export function claimTreasure(hunt) {
  if (!summarize(hunt).canClaim) return false;
  hunt.held = hunt.held.map(count => count - 1);
  hunt.claimed = true;
  return true;
}

function randomIndex(size) {
  const values = new Uint32Array(1);
  const limit = 2 ** 32 - (2 ** 32 % size);
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % size;
}

function loadHunt() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const validCounts = counts => Array.isArray(counts) && counts.length === designs &&
      counts.every(count => Number.isInteger(count) && count >= 0 && count <= copiesPerDesign);
    if (validCounts(saved?.pool) && validCounts(saved?.held) && typeof saved.claimed === 'boolean' &&
        summarize(saved).total <= holdingLimit &&
        saved.held.every((count, index) => count + saved.pool[index] + Number(saved.claimed) === copiesPerDesign)) return saved;
  } catch {
    // A fresh collection is available when storage is disabled or corrupted.
  }
  return newHunt();
}

function setup() {
  const el = id => document.getElementById(id);
  let hunt = loadHunt();
  function render(message, revealedPiece) {
    const state = summarize(hunt);
    el('collection-summary').textContent = hunt.claimed ? 'Treasure claimed' :
      state.unique + ' of 20 designs found · ' + state.total + ' of 50 pieces held';
    el('map-progress').value = hunt.claimed ? designs : state.unique;
    el('map-pieces').replaceChildren(...hunt.held.map((count, index) => {
      const item = document.createElement('li');
      const revealed = count > 0 || hunt.claimed;
      item.className = revealed ? 'found' : '';
      if (index + 1 === revealedPiece) item.classList.add('just-found');
      if (index === 13 && hunt.claimed) item.className += ' treasure';
      item.style.setProperty('--map-x', (index % 5) * 25 + '%');
      item.style.setProperty('--map-y', Math.floor(index / 5) * 100 / 3 + '%');
      item.textContent = hunt.claimed && index === 13 ? '✦' : revealed ? String(index + 1).padStart(2,'0') : '?';
      item.setAttribute('aria-label', 'Piece ' + (index + 1) + (hunt.claimed ? ' revealed' : ', ' + count + ' held'));
      if (count > 1 && !hunt.claimed) {
        const copies = document.createElement('small');
        copies.textContent = '×' + count;
        item.append(copies);
      }
      return item;
    }));
    el('draw-piece').disabled = !state.canDraw;
    el('trade-piece').hidden = !state.canTrade;
    el('claim-map').disabled = !state.canClaim;
    el('hunt-status').textContent = message || (hunt.claimed ? 'You found the treasure at piece 14.' :
      state.canClaim ? 'Map complete. Claim your practice treasure.' : 'Draw a piece to continue exploring.');
  }
  function save(message, revealedPiece) {
    try { localStorage.setItem(storageKey, JSON.stringify(hunt)); }
    catch { message += ' Progress is available for this session only.'; }
    render(message, revealedPiece);
  }
  el('draw-piece').onclick = () => {
    const piece = drawPiece(hunt, randomIndex);
    if (piece) save('Found map piece ' + piece + '.' +
      (summarize(hunt).canClaim ? ' Your map is complete. Claim the treasure.' : ''), piece);
  };
  el('trade-piece').onclick = () => {
    const trade = tradePiece(hunt, randomIndex);
    if (trade) save('Traded a duplicate of piece ' + trade.outgoing + ' for piece ' + trade.incoming + '.', trade.incoming);
  };
  el('claim-map').onclick = () => {
    if (claimTreasure(hunt)) save('Treasure found at piece 14. Your complete set was used for this practice claim.');
  };
  el('reset-hunt').onclick = () => {
    if (!window.confirm('Start over and replace this browser’s practice collection?')) return;
    hunt = newHunt();
    save('New hunt started.');
  };
  render();
}

if (typeof document !== 'undefined') setup();
