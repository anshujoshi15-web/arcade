const bingoCard = [3,19,36,52,67,8,26,42,49,74,12,17,'FREE',57,61,6,22,38,54,70,15,30,45,60,65];

function grid(count, label, values = []) {
  return '<div class="showcase-grid" role="img" aria-label="' + label + '">' +
    Array.from({length:count}, (_, index) =>
      '<span aria-hidden="true">' + (values[index] ?? String(index + 1).padStart(2,'0')) + '</span>'
    ).join('') + '</div>';
}

const choices = (first, second) => '<div class="showcase-choices" aria-hidden="true"><span>' + first +
  '</span><span>' + second + '</span></div>';

const showcases = {
  '/puzzle-print':['puzzle','Collect pieces. Trade duplicates. Complete the artwork.',
    grid(25,'Illustration of the 25-piece Puzzle Print collection'), '25 unique pieces form one complete set.'],
  '/spin-wheel':['wheel','Every spin lands on one of 100 stops.',
    '<div class="showcase-wheel" aria-hidden="true"><span>100</span></div>', 'Some stops award instant prizes or an entry into the weekly jackpot.'],
  '/weekly-bingo':['bingo','Cover all 24 numbers for a blackout.',
    grid(25,'Sample bingo card with a free center',bingoCard), 'The first full card takes the pool. Cards that finish on the same ball share it.'],
  '/treasure-hunt':['treasure','Find the pieces that reveal the hidden spot.',
    grid(20,'Illustration of a 20-piece treasure map'), 'Collect all 20 map pieces and trade duplicates to complete the map.'],
  '/ballz-out':['ballz','Five 50/50 calls. How far would you climb?',
    '<ol class="showcase-ladder" aria-label="Five ladder steps"><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li></ol>',
    'After a correct call, take the current prize or risk it on the next step.'],
  '/play-or-pass':['pass','Pick a side before the number is drawn.',
    choices('PLAY','PASS'), 'One draw from 0 to 99. Both choices are designed for the same long-run payout.'],
  '/ballz-bingo':['ballz-bingo','Fill the card first to take the player pool and NBAA bonus.',
    grid(25,'Sample Ballz Bingo card with a free center',bingoCard), 'The draw requires 6,000 paid cards.']
};

export function gameShowcase(path, game) {
  const [theme, intro, visual, caption] = showcases[path];
  return '<article class="game-showcase showcase-' + theme + '">' +
    '<div><p class="showcase-status">Coming Soon</p>' +
    (game.series ? '<p class="showcase-series">' + game.series + '</p>' : '') +
    '<h1>' + game.name + '</h1><p class="showcase-intro">' + intro + '</p>' +
    '<a href="#planned-rules">See planned rules</a></div>' +
    '<figure><div class="showcase-visual" aria-label="Game illustration">' + visual +
    '</div><figcaption>' + caption + '</figcaption></figure></article>';
}
