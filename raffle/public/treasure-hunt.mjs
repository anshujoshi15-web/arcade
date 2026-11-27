import { playSound } from './game-sounds.mjs';
const designs = 20;
const copiesPerDesign = 1000;
const holdingLimit = 50;
const storageKey = 'house-arcade:treasure-hunt:1';

function shuffledDeck(counts, pick) {
  const deck = counts.flatMap((count, index) => Array(count).fill(index + 1));
  for (let index = deck.length - 1; index > 0; index--) {
    const other = pick(index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

export function newHunt(pick = randomIndex) {
  return {deck:shuffledDeck(Array(designs).fill(copiesPerDesign), pick), held:Array(designs).fill(0),
    claimed:false, spot:pick(designs) + 1};
}

export function summarize({held, claimed, deck}) {
  const unique = held.filter(Boolean).length;
  const total = held.reduce((sum, count) => sum + count, 0);
  return {unique, total, canDraw:!claimed && unique < designs && total < holdingLimit && deck.length > 0,
    canTrade:!claimed && unique < designs && total > unique, canClaim:!claimed && unique === designs};
}

export function drawPiece(hunt) {
  if (!summarize(hunt).canDraw) return null;
  const piece = hunt.deck.pop();
  hunt.held[piece - 1]++;
  return piece;
}

export function tradePiece(hunt, pick = randomIndex) {
  if (!summarize(hunt).canTrade) return null;
  const missing = hunt.held.flatMap((count, index) => count === 0 ? [index] : []);
  const outgoing = hunt.held.findIndex(count => count > 1);
  const incoming = missing[pick(missing.length)];
  hunt.held[outgoing]--;
  hunt.held[incoming]++;
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
    if (!validCounts(saved?.held) || typeof saved.claimed !== 'boolean' ||
        saved.held.reduce((sum, count) => sum + count, 0) > holdingLimit) return newHunt();
    if (Array.isArray(saved.deck) && saved.deck.length <= designs * copiesPerDesign &&
        saved.deck.every(piece => Number.isInteger(piece) && piece >= 1 && piece <= designs) &&
        Number.isInteger(saved.spot) && saved.spot >= 1 && saved.spot <= designs) return saved;
    if (validCounts(saved.pool)) return {held:saved.held, claimed:saved.claimed,
      deck:shuffledDeck(saved.pool, randomIndex), spot:14};

  } catch {
    // A fresh collection is available when storage is disabled or corrupted.
  }
  return newHunt();
}

function setup() {
  const el = id => document.getElementById(id);
  let hunt = loadHunt();
  persist();
  function render(message, revealedPiece) {
    const state = summarize(hunt);
    el('collection-summary').textContent = hunt.claimed ? 'Treasure claimed' :
      state.unique + ' of 20 designs found · ' + state.total + ' of 50 pieces held';
    el('pieces-left').textContent = hunt.deck.length.toLocaleString('en-US') + ' of 20,000';
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
    el('completion-map').hidden = !hunt.claimed;
    el('hunt-status').textContent = message || (hunt.claimed ? 'You found the treasure at piece ' + hunt.spot + '.' :
      state.canClaim ? 'Map complete. Claim your practice treasure.' : 'Draw a piece to continue exploring.');
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(hunt)); return true; }
    catch { return false; }
  }
  function save(message, revealedPiece) {
    if (!persist()) message += ' Progress is available for this session only.';
    render(message, revealedPiece);
  }
  el('draw-piece').onclick = () => {
    const piece = drawPiece(hunt);
    if (piece) playSound(summarize(hunt).canClaim ? 'win' : 'tile');
    if (piece) save('Found map piece ' + piece + '.' +
      (summarize(hunt).canClaim ? ' Your map is complete. Claim the treasure.' : ''), piece);
  };
  el('trade-piece').onclick = () => {
    const trade = tradePiece(hunt, randomIndex);
    if (trade) playSound(summarize(hunt).canClaim ? 'win' : 'trade');
    if (trade) save('Traded a duplicate of piece ' + trade.outgoing + ' for piece ' + trade.incoming + '.', trade.incoming);
  };
  el('claim-map').onclick = () => {
    if (!claimTreasure(hunt)) return;
    playSound('jackpot');
    save('Treasure found at piece ' + hunt.spot + '. Your complete set was used for this practice claim.');
  };
  el('reset-hunt').onclick = () => {
    if (!window.confirm('Start over and replace this browser’s practice collection?')) return;
    hunt = newHunt();
    playSound('reset');
    save('New hunt started.');
  };
  render();
}

if (typeof document !== 'undefined') setup();
