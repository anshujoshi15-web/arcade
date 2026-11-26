const el = id => document.getElementById(id);
const sample = count => crypto.getRandomValues(new Uint32Array(1))[0] % count;
const sequence = count => Array.from({length:count}, (_, index) => index + 1);
function take(pool) { return pool.splice(sample(pool.length), 1)[0]; }
function board(values, columns, marked) {
  el('board').style.gridTemplateColumns = 'repeat(' + columns + ', minmax(0, 1fr))';
  el('board').replaceChildren(...values.map(value => {
    const cell = document.createElement('div');
    cell.className = marked(value) ? 'tile marked' : 'tile';
    cell.textContent = value;
    return cell;
  }));
}

function spin() {
  const wheel = document.createElement('div');
  wheel.className = 'wheel';
  const result = document.createElement('strong');
  result.textContent = '—';
  wheel.append(result);
  el('board').append(wheel);
  el('play').textContent = 'Spin the wheel';
  el('play').onclick = () => {
    const stop = sample(100);
    result.textContent = String(stop);
    const payout = stop === 93 ? 5 : stop >= 89 && stop <= 92 ? 2 : stop >= 74 && stop <= 88 ? 1 : 0;
    el('status').textContent = payout ? 'Instant win: ' + payout + ' practice tokens. Planned bonuses can be paid in a House token of the winner’s choice.' :
      stop >= 94 ? 'Weekly jackpot entry earned in this preview.' : 'Try another spin.';
  };
}

function bingo() {
  const numbers = sequence(75);
  const column = Array.from({length:5}, (_, index) => numbers.slice(index * 15, index * 15 + 15));
  const card = sequence(25).map((_, index) => index === 12 ? 'FREE' : take(column[index % 5]));
  const drawn = new Set(['FREE']);
  const paint = () => board(card, 5, value => drawn.has(value));
  paint();
  el('play').textContent = 'Draw next ball';
  el('play').onclick = () => {
    const ball = take(numbers);
    drawn.add(ball);
    paint();
    const complete = card.every(value => drawn.has(value));
    el('status').textContent = 'Ball ' + ball + (complete ? ' · Blackout! Your card is complete.' : '');
    el('play').disabled = complete;
  };
}

function hunt() {
  const copies = Array.from({length:20000}, (_, index) => index % 20 + 1);
  const held = new Map();
  const paint = () => board(sequence(20), 5, id => held.has(id));
  paint();
  el('play').textContent = 'Draw map piece';
  el('trade').hidden = false;
  function update(message) {
    paint();
    const complete = held.size === 20;
    el('status').textContent = message + ' · ' + held.size + ' of 20 pieces' + (complete ? ' · Map complete!' : '');
    el('play').disabled = complete || [...held.values()].reduce((a,b) => a+b,0) >= 50;
    el('trade').disabled = complete || ![...held.values()].some(count => count > 1);
  }
  el('play').onclick = () => {
    const id = take(copies);
    held.set(id, (held.get(id) || 0) + 1);
    update('Received piece ' + id);
  };
  el('trade').onclick = () => {
    const [outgoing,count] = [...held].find(([, amount]) => amount > 1);
    const incoming = sequence(20).find(id => !held.has(id));
    held.set(outgoing,count - 1);
    held.set(incoming,1);
    update('Traded for piece ' + incoming);
  };
  update('Collection empty');
}

const games = {
  '/spin-wheel': ['Spin Wheel','Spin a 100-stop wheel for instant wins and weekly jackpot entries.','Wheel',spin],
  '/weekly-bingo': ['Weekly Bingo','Draw from 75 balls and mark your card. Complete all 24 numbers to win a blackout.','Your bingo card',bingo],
  '/treasure-hunt': ['Treasure Hunt','Collect all 20 map pieces and trade duplicates to complete the set.','Your map collection',hunt]
};
const [title, description, heading, play] = games[location.pathname];
el('title').textContent = title;
el('description').textContent = description;
el('section-title').textContent = heading;
play();
