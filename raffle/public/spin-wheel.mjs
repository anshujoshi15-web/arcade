export function spinResult(stop) {
  if (stop >= 94) return {tokens:0, jackpot:1, label:'Practice jackpot entry earned.'};
  const tokens = stop === 93 ? 5 : stop >= 89 ? 2 : stop >= 74 ? 1 : 0;
  const label = tokens ? 'You earned ' + tokens + ' practice ' + (tokens === 1 ? 'token.' : 'tokens.') : 'No win this spin.';
  return {tokens, jackpot:0, label};
}

function randomStop() {
  const value = new Uint8Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 200);
  return value[0] % 100;
}

function setup() {
  const el = id => document.getElementById(id);
  const button = el('spin');
  const disc = el('spin-disc');
  let angle = 0;
  let spins = 0;
  let tokens = 0;
  let entries = 0;
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    el('spin-result').textContent = 'Spinning…';
    el('spin-stop').textContent = '—';
    const stop = randomStop();
    const position = (360 - (stop + .5) * 3.6) % 360;
    const next = angle + 360 * 6 + (position - angle % 360 + 360) % 360;
    const finalTransform = 'rotate(' + position + 'deg)';
    try {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const animation = disc.animate([
          {transform:'rotate(' + angle + 'deg)'}, {transform:'rotate(' + next + 'deg)'}
        ], {duration:5200,easing:'cubic-bezier(.12,.45,.27,1)'});
        await animation.finished.catch(() => {});
      }
      disc.style.transform = finalTransform;
      angle = position;
      const result = spinResult(stop);
      const label = String(stop).padStart(2,'0');
      el('spin-stop').textContent = label;
      el('spin-result').textContent = 'Stop ' + label + '. ' + result.label;
      el('spin-count').textContent = ++spins;
      el('token-count').textContent = tokens += result.tokens;
      el('jackpot-count').textContent = entries += result.jackpot;
    } finally {
      button.disabled = false;
      button.focus({preventScroll:true});
    }
  });
}

if (typeof document !== 'undefined') setup();
