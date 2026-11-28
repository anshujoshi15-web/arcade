const eth = (value, currency = 'Base ETH') => '$' + value.toLocaleString('en-US', {maximumFractionDigits:2}) + ' in ' + currency;
const paidEntrySplit = 'Each 1 USDC paid entry is split into 0.34 USDC (34%) for donations, 0.33 USDC (33%) for the House, and 0.33 USDC (33%) for player prizes. Free entries add no funds to the split.';
const nbaa = {
  artwork:'/nbaa-cover.jpg',
  series:'NBAA · No Ballz At All',
  freeEntry:'One free play per wallet each week. Free-play prizes are awarded in House tokens.',
  bonus:'Planned House-token bonus choices include EVO, Kaboom, King Joshi, Queen Joshi, KIND, and NBAA. NBAA is a Cronos token. Any NBAA bonus would be delivered separately on Cronos, subject to published payout instructions.'
};
export const gameRules = {
  '/spin-wheel': {
    name:'Spin Wheel',
    entry:'1 USDC on Base per spin. Up to 25 per purchase, 100 per wallet per day, and 500 per week.',
    rows:[['0–73','No win'],['74–88','$1 in Base ETH / 1 bonus token'],['89–92','$2 in Base ETH / 2 bonus tokens'],['93','$5 in Base ETH / 5 bonus tokens'],['94–99','Weekly jackpot entry']],
    headings:['Wheel stops','Paid result / free result'],
    notes:[paidEntrySplit, 'All 100 stops have equal weight. On-chain randomness determines the result. Free spins can earn jackpot entries and pay instant bonuses in the winner’s chosen House token.',
      'The weekly jackpot accrues $0.05 in Base ETH value per paid spin, plus rollover. The jackpot draw is scheduled for Sunday at 8 p.m. Mountain Time (03:00 UTC Monday during MST, 02:00 UTC Monday during MDT). It needs 2,000 paid spins and at least one jackpot entry. If either is missing, the jackpot carries forward.']
  },
  '/weekly-bingo': {
    name:'Weekly Bingo',
    prizeCurrency:'Base ETH',
    entry:'1 USDC on Base per card. Up to 10,000 cards per round, 25 per purchase, and 100 per wallet.',
    rows:[6000, 8000, 10000].map(cards => [
      cards.toLocaleString('en-US') + ' paid cards', eth(cards * 33 / 100, 'Base ETH')
    ]),
    headings:['Paid card sales','Entire prize pool'],
    notes:[paidEntrySplit, 'The first card to cover all 24 numbers wins the entire prize pool in Base ETH. Each 5 × 5 NFT card has a free center. If several cards finish on the same ball, those cards split the entire pool equally. The pool is 33% of actual paid sales.',
      'The scheduled Bingo draw is Sunday at 7 p.m. Mountain Time (02:00 UTC Monday during MST, 01:00 UTC Monday during MDT). In standard time this is one hour after a 01:00 UTC Monday Raffle sales checkpoint. During daylight time the two coincide if the Raffle checkpoint remains at 01:00 UTC. If sales are below 6,000 paid cards at the first Sunday close, the round can roll over for up to four weeks past that close. During postponement, sales stay open, cards stay valid, and the full pot carries forward.',
      'If the round is still below 6,000 paid cards at the four-week limit, entries close. The House can end the round before the draw. If the House cancels or closes the round without a draw, it manually refunds original buyers in full in USDC and voids free and bonus cards. Postponement alone does not trigger refunds.']
  },
  '/treasure-hunt': {
    name:'Treasure Hunt',
    entry:'2 USDC per piece. There are 20 map designs with 1,000 copies each. Up to 25 per purchase, 50 held per wallet, and one claim per wallet.',
    rows:[6000,3200,2000,1200,800].map((value,index)=>[String(index+1),eth(value)]).concat([['Total',eth(13200)]]),
    headings:['Claim order','Prize at paid sellout'],
    notes:[
      'One 20,000-piece pool is shuffled before launch. Each paid or free draw takes the next tile without checking what the player owns. Duplicate pieces can be traded. The hidden gold X appears only after all 20 tiles are assembled.',
      'The planned launch uses Base ERC-1155 token IDs 1–20 for numbered pieces. A successful claim burns one of each piece and issues the completed map as token ID 21. The first five eligible claims are ranked in claim order.',
      'Treasure Hunt has a funding-order exception: the first 5,600 paid pieces fund only the prize reserve. That is 11,200 USDC at 2 USDC per piece, covering the first three sellout prizes. The 34% donation and 33% House allocations begin funding from later sales. The 34/33/33 split describes the fully paid sellout totals; it does not apply to each purchase under this exception. Each later prize unlocks when funded.',
      'At a fully paid sellout, 40,000 USDC of gross funds 13,600 for donations, 13,200 for the House, and 13,200 in Base ETH prize value. Free pieces come from the same pool and add no revenue.',
      'The planned hunt publishes commitments to the shuffled order and hidden cell before sales, with the underlying values revealed at settlement. Each participating wallet may nominate one charity.',
      'If the hunt is below the 5,600-paid-piece funding gate and sales stall for 180 days, the House may close the hunt and refund paid buyers in full.'
    ]
  },
  '/ballz-out': {
    ...nbaa,
    name:'Ballz Out',
    entry:'Planned price: 1 USDC per play. Make a 50/50 call on each step of a five-step double-or-nothing ladder.',
    headings:['Step','Free practice cash-out'],
    rows:[2,4,8,16,32].map((points, index) => ['Step ' + (index + 1), points + ' practice points']),
    notes:[paidEntrySplit, 'A correct call advances one step. After a win, cash out or risk the ladder on the next call. A miss loses the current ladder prize.',
      'Practice points have no payout value. The five paid-play prize amounts and the funding requirement for each step must be published before paid play opens.']
  },
  '/play-or-pass': {
    ...nbaa,
    name:'Play or Pass',
    entry:'Planned price: 1 USDC per play. Pick PLAY or PASS before a single draw from 0 to 99.',
    headings:['Choice','Winning range in free practice'],
    rows:[['PLAY','00–49 · one practice point on a hit'],['PASS','50–99 · one practice point on a hit']],
    notes:[paidEntrySplit, 'Each practice choice covers 50 of the 100 possible numbers. A miss scores zero. The two paid choices are designed for the same long-run payout. The paid-play ranges and prize amounts must be published before launch.']
  },
  '/ballz-bingo': {
    ...nbaa,
    name:'Ballz Bingo',
    freeEntry:'One free card per wallet each week. Free-card prize eligibility will be published before paid rounds open.',
    entry:'Planned price: 1 USDC per card. Balls are drawn one at a time until the first card fills.',
    headings:['Round state','Result'],
    rows:[['Below 6,000 paid cards','Round postpones and the pot carries forward'],['First full card','Wins the entire player pool plus the NBAA bonus pool']],
    notes:[paidEntrySplit,
      'Arcade rivals are part of free practice. In a planned prize round, players compete against other entrants’ cards.',
      'The planned postponement limit is four weeks after the first Sunday sales close. If the House ends the round without a draw, original buyers receive full manual USDC refunds and free cards are void. Postponement alone does not trigger refunds.',
      'The NBAA bonus pool is intended to grow as paid cards sell. The draw time, NBAA contribution rate and funding source, and whether free cards qualify for the main pool or token prizes will be published before paid rounds open.']
  },
  '/puzzle-print': {
    name:'Puzzle Print',
    prizeCurrency:'Base ETH',
    entry:'$2 worth of crypto per piece. The pool has 25,000 pieces across 25 designs. Up to 25 pieces per transaction, 50 held, and one claim per wallet.',
    rows:[['1st',eth(5000,'Base ETH')],['2nd',eth(4000,'Base ETH')],['3rd',eth(3000,'Base ETH')],['4th to 9th (each)',eth(642.86,'Base ETH')],['10th',eth(642.84,'Base ETH')],['Total',eth(16500,'Base ETH')]],
    headings:['Claim order','Prize at paid sellout'],
    notes:['Trade duplicates and collect all 25 pieces. Claims burn the pieces and award the completed artwork as a token. Each paid piece costs $2 in crypto. Donations receive 34% ($0.68), the House receives 33% ($0.66), and the prize pool receives 33% ($0.66). Claims open at 18,182 paid pieces, which contribute $12,000.12 in prize value and cover the $12,000 combined top three prizes. Later places unlock as funded.',
      'At $50,000 paid gross, the split is $17,000 in crypto for the donation, $16,500 in crypto for the House, and $16,500 in Base ETH prize value for player prizes. Paid gross excludes free pieces.']
  }
};

export function upcomingRules(game) {
  const rows = game.rows.map(([key, value]) => '<tr><th scope="row">' + key + '</th><td>' + value + '</td></tr>').join('');
  return '<section id="planned-rules"><h2>Planned game rules</h2><p>' + game.entry + '</p>' +
    '<p>' + (game.freeEntry || 'One free entry per wallet per week.') +
    ' No purchase is necessary. Players must be 18 or older.</p>' +
    '<table class="upcoming-prizes"><thead><tr>' +
    game.headings.map(label => '<th scope="col">' + label + '</th>').join('') +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    game.notes.map(note => '<p>' + note + '</p>').join('') +
    '<p>Main prizes are shown in USD value and paid in ' + (game.prizeCurrency || 'Base ETH') + '. ' + (game.bonus || 'Bonuses use a House token of the winner’s choice.') + '</p>' +
    '<p><a href="/rules">Read the Arcade General Rules</a></p></section>' +
    (game.artwork ? '<section><h2>About NBAA</h2><p>NBAA is the series’ Cronos token.</p><img class="game-cover" src="' +
      game.artwork + '" width="1600" height="1600" loading="lazy" alt="No Ballz At All cover artwork"></section>' : '');
}
