import { playSound } from './game-sounds.mjs';
const storageKey = 'house-arcade-puzzle-v1';
const types = Array.from({length:25}, (_, index) => index + 1);

function randomIndex(size) {
  const limit = 2 ** 32 - (2 ** 32 % size);
  const word = new Uint32Array(1);
  do { crypto.getRandomValues(word); } while (word[0] >= limit);
  return word[0] % size;
}

export function newGame(pick = randomIndex) {
  const deck = Array.from({length:25000}, (_, index) => index % 25 + 1);
  for (let end = deck.length - 1; end > 0; end--) {
    const swap = pick(end + 1);
    [deck[end], deck[swap]] = [deck[swap], deck[end]];
  }
  return {deck, held:Array(26).fill(0), freeWeek:null, entered:false, nomination:null, claimed:false};
}
const week = () => Math.floor((Date.now() + 3 * 86400000) / (7 * 86400000));
const total = game => game.held.reduce((sum, count) => sum + count, 0);
const missing = game => types.filter(id => !game.held[id]);
const duplicate = game => types.find(id => game.held[id] > 1);

export function draw(game, count, free = false, currentWeek = week()) {
  if (game.claimed || (free && (count !== 1 || game.freeWeek === currentWeek)) ||
      !Number.isInteger(count) || count < 1 || count > 25 ||
      total(game) + count > 50 || count > game.deck.length) return [];
  const drawn = game.deck.splice(-count).reverse();
  for (const id of drawn) game.held[id]++;
  game.entered = true;
  if (free) game.freeWeek = currentWeek;
  return drawn;
}

export function trade(game, incoming) {
  const outgoing = duplicate(game);
  if (game.claimed || !outgoing || !missing(game).includes(incoming)) return null;
  game.held[outgoing]--;
  game.held[incoming]++;
  return outgoing;
}

export function claim(game) {
  if (game.claimed || missing(game).length) return false;
  for (const id of types) game.held[id]--;
  game.claimed = true;
  return true;
}

function loadGame() {
  try {
    const game = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(game?.held) && game.held.length === 26 &&
        game.held.every(count => Number.isInteger(count) && count >= 0) && total(game) <= 50 &&
        Array.isArray(game.deck) && game.deck.length <= 25000 &&
        game.deck.every(id => Number.isInteger(id) && id >= 1 && id <= 25) &&
        typeof game.claimed === 'boolean') return game;
  } catch {
    // The preview still works with a new collection if storage is unavailable.
  }
  return newGame();
}

// Trace each seam in board coordinates so adjoining pieces share the same curve.
function seam(x, y, dx, dy, tab) {
  const point = (along, depth = 0) =>
    [x + dx * along - Math.abs(dy) * depth * tab, y + dy * along + Math.abs(dx) * depth * tab].join(' ');
  if (!tab) return 'L ' + point(100);
  return 'L ' + point(39) + ' C ' + point(46) + ' ' + point(37, 15) + ' ' + point(50, 15) +
    ' C ' + point(63, 15) + ' ' + point(54) + ' ' + point(61) + ' L ' + point(100);
}

export function jigsawPath(id) {
  const column = (id - 1) % 5;
  const row = Math.floor((id - 1) / 5);
  const polarity = (x, y) => (x + y) % 2 ? -1 : 1;
  return 'M 0 0 ' +
    seam(0, 0, 1, 0, row ? polarity(column, row) : 0) + ' ' +
    seam(100, 0, 0, 1, column < 4 ? polarity(column + 1, row) : 0) + ' ' +
    seam(100, 100, -1, 0, row < 4 ? polarity(column, row + 1) : 0) + ' ' +
    seam(0, 100, 0, -1, column ? polarity(column, row) : 0) + ' Z';
}

function svgElement(tag, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function renderPiece(id, count, claimed, revealed) {
  const x = ((id - 1) % 5) * 100;
  const y = Math.floor((id - 1) / 5) * 100;
  const shown = count > 0 || claimed;
  const path = jigsawPath(id);
  const clipId = 'print-piece-' + id;
  const item = svgElement('g', {
    transform:'translate(' + x + ' ' + y + ')',
    class:shown ? 'jigsaw-piece owned' : 'jigsaw-piece',
    role:'img',
    'aria-label':'Piece ' + id + (claimed ? ', completed' : ', ' + count + ' held')
  });
  const art = svgElement('g', {class:revealed ? 'just-found' : ''});
  if (shown) {
    const clip = svgElement('clipPath', {id:clipId});
    clip.append(svgElement('path', {d:path}));
    art.append(clip, svgElement('image', {
      href:'/puzzle-art.jpg', x:-x, y:-y, width:500, height:500,
      preserveAspectRatio:'xMidYMid slice', 'clip-path':'url(#' + clipId + ')'
    }));
  }
  art.append(svgElement('path', {d:path, class:'jigsaw-edge'}));
  if (!claimed) {
    const number = svgElement('text', {x:50, y:55, 'text-anchor':'middle', 'aria-hidden':'true'});
    number.textContent = count > 1 ? id + ' ×' + count : id;
    art.append(number);
  }
  item.append(art);
  return item;
}

function setup() {
  const el = id => document.getElementById(id);
  let game = loadGame();
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(game)); return true; }
    catch { return false; }
  }
  persist();

  function render(revealed = []) {
    const absent = missing(game);
    el('board').classList.toggle('completed', game.claimed);
    el('board').replaceChildren(...types.map(id =>
      renderPiece(id, game.held[id], game.claimed, revealed.includes(id))));
    el('collection').textContent = game.claimed ? 'Completed print claimed' :
      (25 - absent.length) + ' of 25 unique pieces · ' + total(game) + ' of 50 held';
    el('print-progress').value = game.claimed ? 25 : 25 - absent.length;
    el('pool').textContent = game.deck.length.toLocaleString() + ' of 25,000 pieces left in the practice pool';
    const select = el('trade');
    const choice = select.value;
    select.replaceChildren(...absent.map(id => new Option('Piece ' + id, id)));
    if (absent.includes(Number(choice))) select.value = choice;
    const max = Math.min(25, 50 - total(game), game.deck.length);
    const quantity = el('quantity');
    quantity.max = Math.max(1, max);
    if (quantity.valueAsNumber > max && max > 0) quantity.value = max;
    el('draw').disabled = quantity.disabled = game.claimed || !max;
    el('free').disabled = el('draw').disabled || game.freeWeek === week();
    el('swap').disabled = select.disabled = game.claimed || !duplicate(game) || !absent.length;
    el('nominate').disabled = el('charity').disabled = !game.entered || Boolean(game.nomination);
    if (game.nomination) el('charity').value = game.nomination;
    el('claim').disabled = game.claimed || absent.length > 0;
    el('completed-print').hidden = !game.claimed;
  }

  function save(message, revealed) {
    if (!persist()) message += ' Progress is available for this session only.';
    el('status').textContent = message;
    render(revealed);
  }
  function play(count, free) {
    const drawn = draw(game, count, free);
    if (!drawn.length) {
      el('status').textContent = 'Check the draw quantity, holding limit, and weekly free entry availability.';
      render();
      return;
    }
    playSound(missing(game).length === 0 ? 'win' : free ? 'ticket' : 'tile');
    save('Drawn pieces: ' + drawn.join(', ') + '.', drawn);
  }
  el('draw').onclick = () => play(el('quantity').valueAsNumber, false);
  el('free').onclick = () => play(1, true);
  el('swap').onclick = () => {
    const incoming = Number(el('trade').value);
    const outgoing = trade(game, incoming);
    if (outgoing) playSound(missing(game).length === 0 ? 'win' : 'trade');
    if (outgoing) save('Traded a duplicate of piece ' + outgoing + ' for piece ' + incoming + '.', [incoming]);
  };
  el('nominate').onclick = () => {
    if (!game.entered || game.nomination) return;
    game.nomination = el('charity').value;
    save('Practice nomination recorded: ' + game.nomination + '.');
  };
  el('claim').onclick = () => {
    if (!claim(game)) return;
    playSound('jackpot');
    save('Your completed practice print is ready to download.');
  };
  el('reset-puzzle').onclick = () => {
    if (!window.confirm('Replace this browser’s practice collection and start over?')) return;
    game = newGame();
    playSound('reset');
    save('New print started.');
  };
  render();
  void fetch('/puzzle-print/config').then(response => response.json()).then(config => {
    el('paid-puzzle-link').hidden = !config.address;
  }).catch(() => {});
}

if (typeof document !== 'undefined') setup();
