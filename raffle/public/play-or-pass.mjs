export const numberSide = number => number < 50 ? 'play' : 'pass';
const pad = number => String(number).padStart(2,'0');

function drawNumber() {
  const word = new Uint8Array(1);
  do { crypto.getRandomValues(word); } while (word[0] >= 200);
  return word[0] % 100;
}

function setup() {
  const el = id => document.getElementById(id);
  const display = el('pass-display');
  const status = el('pass-result');
  const sides = ['play', 'pass'];
  let rounds = 0;
  let points = 0;
  let streak = 0;
  let revealing = false;

  for (const side of sides) {
    const button = el('pick-' + side);
    button.disabled = false;
    button.onclick = async () => {
      if (revealing) return;
      revealing = true;
      const number = drawNumber();
      sides.forEach(choice => { el('pick-' + choice).disabled = true; });
      delete display.dataset.side;
      status.textContent = 'The Arcade is having a think…';
      display.textContent = '…';
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && display.animate) {
        await display.animate([
          {transform:'scale(1)'}, {transform:'scale(.92)',opacity:.62}, {transform:'scale(1)'}
        ], {duration:900,easing:'ease-in-out'}).finished.catch(() => {});
      }
      const result = numberSide(number);
      const correct = side === result;
      display.textContent = pad(number);
      display.dataset.side = result;
      rounds++;
      points += Number(correct);
      streak = correct ? streak + 1 : 0;
      el('pass-rounds').textContent = rounds;
      el('pass-points').textContent = points;
      el('pass-streak').textContent = streak;
      status.textContent = pad(number) + ' lands on ' + result.toUpperCase() + '. ' +
        (correct ? 'Good call. One practice point.' : 'Wrong side. The number had other plans.');
      revealing = false;
      sides.forEach(choice => { el('pick-' + choice).disabled = false; });
    };
  }
}
if (typeof document !== 'undefined') setup();
