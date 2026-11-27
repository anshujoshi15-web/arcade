const letters = 'BINGO';
const range = (size, start = 1) => Array.from({length:size}, (_, i) => start + i);

function randomIndex(size) {
  const word = new Uint8Array(1);
  const limit = 256 - 256 % size;
  do { crypto.getRandomValues(word); } while (word[0] >= limit);
  return word[0] % size;
}

export function newBingo(pick = randomIndex) {
  const columns = range(5, 0).map(index => range(15, index * 15 + 1));
  const card = range(25, 0).map(index => {
    if (index === 12) return null;
    const column = columns[index % 5];
    return column.splice(pick(column.length), 1)[0];
  });
  return {card, pool:range(75), calls:[]};
}

export function markedCount(game) {
  return game.card.filter(number => number !== null && game.calls.includes(number)).length;
}

export function drawBall(game, pick = randomIndex) {
  if (!game.pool.length || markedCount(game) === 24) return null;
  const [ball] = game.pool.splice(pick(game.pool.length), 1);
  game.calls.push(ball);
  return ball;
}

function ballLabel(ball) {
  return letters[Math.floor((ball - 1) / 15)] + '–' + ball;
}

function setup() {
  const el = id => document.getElementById(id);
  let game = newBingo();
  function render(latest) {
    const marked = markedCount(game);
    const rows = range(5, 0).map(index => {
      const row = document.createElement('tr');
      for (const number of game.card.slice(index * 5, index * 5 + 5)) {
        const cell = document.createElement('td');
        const matched = number === null || game.calls.includes(number);
        cell.textContent = number ?? 'FREE';
        if (matched) cell.classList.add('marked');
        if (number === latest) cell.classList.add('latest');
        if (number !== null) cell.setAttribute('aria-label', number + (matched ? ', marked' : ', unmarked'));
        row.append(cell);
      }
      return row;
    });
    el('bingo-card').replaceChildren(...rows);
    el('bingo-progress').textContent = marked + ' of 24 numbers marked';
    el('bingo-meter').value = marked;
    el('latest-ball').textContent = latest ? ballLabel(latest) : '—';
    el('draw-count').textContent = game.calls.length + ' of 75 balls called';
    el('draw-ball').disabled = marked === 24;
    el('ball-history').replaceChildren(...game.calls.map(ball => {
      const item = document.createElement('li');
      item.textContent = ballLabel(ball);
      return item;
    }));
  }
  el('draw-ball').onclick = () => {
    const ball = drawBall(game);
    if (!ball) return;
    render(ball);
    el('bingo-status').textContent = ballLabel(ball) + '. ' +
      (markedCount(game) === 24 ? 'Blackout! You filled the card.' :
        game.card.includes(ball) ? 'Marked on your card.' : 'This ball does not match your card.');
  };
  el('new-card').disabled = false;
  el('new-card').onclick = () => {
    game = newBingo();
    render();
    el('bingo-status').textContent = 'New card ready. Draw a ball to start.';
  };
  render();
}
if (typeof document !== 'undefined') setup();
