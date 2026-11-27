const steps = [2, 4, 8, 16, 32];
const rungNames = ['Tiny flex', 'Getting cocky', 'Questionable confidence', 'Tell nobody', 'Certified Ballz'];
const reactions = {
  win:['Good call. Your imaginary accountant is impressed.', 'Look at you, making a 50/50 look intentional.', 'You may now refer to this as a strategy.'],
  bust:['The orb would like to thank you for your confidence.', 'A bold strategy. The orb had notes.', 'Well, that was a very confident oops.'],
  cash:['A responsible decision? In this arcade?', 'Your imaginary accountant can finally exhale.', 'Quit while ahead. Terrible for drama, great for your points.']
};

export function resolveCall(level, guess, face) {
  const won = guess === face;
  const nextLevel = won ? level + 1 : 0;
  return {won, level:nextLevel, points:steps[nextLevel - 1] || 0, finished:!won || nextLevel === steps.length};
}

function setup() {
  const el = id => document.getElementById(id);
  const calls = [el('call-blue'), el('call-gold')];
  const cash = el('cash-out');
  const restart = el('new-run');
  const status = el('ballz-result');
  let level = 0;
  let banked = 0;
  let finished = false;
  let revealing = false;
  let attempts = 0;
  let cashouts = 0;
  const reaction = (kind, index) => reactions[kind][index % reactions[kind].length];

  const render = () => {
    el('ladder').replaceChildren(...steps.map((points, index) => {
      const row = document.createElement('li');
      const label = document.createElement('span');
      const total = document.createElement('strong');
      label.textContent = rungNames[index];
      total.textContent = points + ' points';
      row.append(label, total);
      if (index < level) row.classList.add('cleared');
      if (!finished && index === level) row.setAttribute('aria-current', 'step');
      return row;
    }));
    el('ladder-points').textContent = (finished ? 0 : steps[level - 1] || 0) + ' points';
    el('banked-points').textContent = banked + ' points';
    calls.forEach(button => { button.disabled = finished || revealing; });
    cash.disabled = finished || revealing || level === 0;
    restart.hidden = !finished;
  };

  async function play(guess) {
    if (finished || revealing) return;
    revealing = true;
    render();
    const orb = el('orb');
    const face = crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? 'Gold' : 'Blue';
    delete orb.dataset.face;
    status.textContent = 'The orb is thinking. Allegedly…';
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && orb.animate) {
      await orb.animate([{transform:'translateY(0)'},{transform:'translateY(-16px) rotate(-9deg) scale(.96)'},{transform:'translateY(-8px) rotate(9deg)'},{transform:'translateY(0)'}],
        {duration:950,easing:'ease-in-out'}).finished.catch(() => {});
    }
    orb.dataset.face = face;
    const result = resolveCall(level, guess, face);
    level = result.level;
    finished = result.finished;
    if (result.won && finished) {
      banked += result.points;
    }
    revealing = false;
    const turn = attempts++;
    status.textContent = face + '. ' + (!result.won ? 'Bust. ' + reaction('bust', turn) :
      finished ? result.points + ' practice points banked. You are insufferable now.' :
      reaction('win', turn) + ' Cash out or climb to step ' + (level + 1) + '.');
    render();
  }

  calls[0].onclick = () => void play('Blue');
  calls[1].onclick = () => void play('Gold');
  cash.onclick = () => {
    if (finished || revealing || !level) return;
    const points = steps[level - 1];
    banked += points;
    finished = true;
    status.textContent = 'Cashed out ' + points + ' practice points. ' + reaction('cash', cashouts++);
    render();
  };
  restart.onclick = () => {
    level = 0;
    finished = false;
    delete el('orb').dataset.face;
    status.textContent = 'Fresh ladder. The orb remembers nothing. Call Blue or Gold.';
    render();
  };
  render();
}
if (typeof document !== 'undefined') setup();
