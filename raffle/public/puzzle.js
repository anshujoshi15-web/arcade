const key = 'house-arcade-puzzle-v1';
const el = id => document.getElementById(id);
const types = Array.from({length:25}, (_, index) => index + 1);

function newGame() {
  const deck = Array.from({length:25000}, (_, index) => index % 25 + 1);
  for (let end = deck.length - 1; end > 0; end--) {
    const ceiling = 2 ** 32 - (2 ** 32 % (end + 1));
    const word = new Uint32Array(1);
    do { crypto.getRandomValues(word); } while (word[0] >= ceiling);
    const swap = word[0] % (end + 1);
    [deck[end], deck[swap]] = [deck[swap], deck[end]];
  }
  return {deck, held: Array(26).fill(0), freeWeek:null, entered:false, nomination:null, claimed:false};
}

const game = JSON.parse(localStorage.getItem(key) || 'null') || newGame();
const week = () => Math.floor((Date.now() + 3 * 86400000) / (7 * 86400000));
const total = () => game.held.reduce((sum, count) => sum + count, 0);
const missing = () => types.filter(id => !game.held[id]);
const duplicate = () => types.find(id => game.held[id] > 1);

function save(message) {
  localStorage.setItem(key, JSON.stringify(game));
  el('status').textContent = message;
  render();
}

function draw(count, free) {
  if (game.claimed || (free && game.freeWeek === week())) return;
  if (!Number.isInteger(count) || count < 1 || count > 25 || total() + count > 50 || count > game.deck.length) {
    el('status').textContent = 'Draw 1–25 pieces at a time, up to 50 held and within the remaining pool.';
    return;
  }
  const drawn = [];
  for (let index = 0; index < count; index++) {
    const id = game.deck.pop();
    game.held[id]++;
    drawn.push(id);
  }
  game.entered = true;
  if (free) game.freeWeek = week();
  save('Drawn pieces: ' + drawn.join(', '));
}

function render() {
  const absent = missing();
  el('board').replaceChildren(...types.map(id => {
    const item = document.createElement('div');
    item.className = 'piece';
    const shown = game.held[id] || game.claimed;
    if (shown) {
      item.classList.add('owned');
      item.style.backgroundPosition = ((id - 1) % 5) * 25 + '% ' + Math.floor((id - 1) / 5) * 25 + '%';
    } else item.textContent = id;
    item.setAttribute('aria-label', 'Piece ' + id + (game.claimed ? ', completed' : ', ' + game.held[id] + ' held'));
    return item;
  }));
  el('collection').textContent = game.claimed ? 'Completed print claimed' :
    (25 - absent.length) + ' of 25 unique pieces · ' + total() + ' of 50 held';
  el('pool').textContent = game.deck.length.toLocaleString() + ' pieces left in your practice pool';
  const choice = el('trade').value;
  el('trade').replaceChildren(...absent.map(id => new Option('Piece ' + id, id)));
  if (absent.includes(Number(choice))) el('trade').value = choice;
  el('draw').disabled = game.claimed || total() >= 50 || !game.deck.length;
  el('free').disabled = el('draw').disabled || game.freeWeek === week();
  el('swap').disabled = game.claimed || !duplicate() || !absent.length;
  el('nominate').disabled = !game.entered || Boolean(game.nomination);
  if (game.nomination) el('charity').value = game.nomination;
  el('claim').disabled = game.claimed || absent.length > 0;
}

el('draw').onclick = () => draw(Number(el('quantity').value), false);
el('free').onclick = () => draw(1, true);
el('swap').onclick = () => {
  const outgoing = duplicate();
  const incoming = Number(el('trade').value);
  if (!outgoing || !missing().includes(incoming) || game.claimed) return;
  game.held[outgoing]--;
  game.held[incoming]++;
  save('Traded a duplicate of piece ' + outgoing + ' for piece ' + incoming + '.');
};
el('nominate').onclick = () => {
  if (!game.entered || game.nomination) return;
  game.nomination = el('charity').value;
  save('Nomination recorded: ' + game.nomination);
};
el('claim').onclick = () => {
  if (game.claimed || missing().length) return;
  for (const id of types) game.held[id]--;
  game.claimed = true;
  save('Your completed practice print is ready.');
};
render();
