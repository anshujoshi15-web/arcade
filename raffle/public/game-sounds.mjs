const storageKey = 'house-arcade-sound';
const motifs = {
  tile: ['sine', [620, 830], .075],
  trade: ['triangle', [550, 750, 540], .075],
  spin: ['triangle', [240, 320, 420, 560], .065],
  ball: ['sine', [310, 220], .075],
  match: ['triangle', [650, 880], .08],
  reveal: ['sine', [280, 390], .12],
  miss: ['triangle', [330, 245], .12],
  win: ['triangle', [523, 659, 784, 1047], .105],
  jackpot: ['triangle', [523, 659, 784, 988, 1175], .12],
  cash: ['sine', [760, 570, 950], .085],
  reset: ['sine', [350, 550], .065],
  pending: ['sine', [415, 494], .11],
  ticket: ['triangle', [494, 659, 988], .085]
};

let context;
let muted = false;
let toggle;
const active = new Set();

if (typeof window !== 'undefined') {
  try { muted = localStorage.getItem(storageKey) === 'off'; } catch {}
  const container = document.querySelector('.practice-hero, .raffle-actions');
  if (container) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'game-sound-toggle';
    toggle.setAttribute('aria-label', 'Mute game sound');
    updateToggle();
    container.append(toggle);
    toggle.addEventListener('click', () => {
      muted = !muted;
      try { localStorage.setItem(storageKey, muted ? 'off' : 'on'); } catch {}
      if (muted) stopSounds();
      updateToggle();
      if (!muted) playSound('tile');
    });
    window.addEventListener('storage', event => {
      if (event.key !== storageKey) return;
      muted = event.newValue === 'off';
      if (muted) stopSounds();
      updateToggle();
    });
  }
}

function updateToggle() {
  toggle.textContent = muted ? 'Sound off' : 'Sound on';
  toggle.setAttribute('aria-pressed', String(muted));
}

function stopSounds() {
  for (const note of active) note.stop();
  active.clear();
}

export function playSound(name) {
  const motif = motifs[name];
  if (!motif || muted || typeof window === 'undefined' || document.hidden) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    context ??= new Audio();
    if (context.state === 'running') playMotif(motif);
    else void context.resume().then(() => {
      if (!muted && !document.hidden && context.state === 'running') playMotif(motif);
    }).catch(() => {});
  } catch {
    // Audio is optional when the browser blocks it.
  }
}

function playMotif([type, frequencies, interval]) {
  stopSounds();
  const now = context.currentTime;
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * interval;
    const end = start + interval * 1.25;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(.075, start + .012);
    gain.gain.exponentialRampToValueAtTime(.001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    active.add(oscillator);
    oscillator.onended = () => {
      active.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(end);
  });
}
