const eth = (value, currency = 'ETH') => '$' + value.toLocaleString('en-US', {maximumFractionDigits:2}) + ' in ' + currency;
const paidEntrySplit = 'Each 1 USDC paid entry is split into 0.34 USDC (34%) for donations, 0.33 USDC (33%) for the House, and 0.33 USDC (33%) for player prizes. Free entries add no funds to the split.';
const nbaa = {
  artwork:'/nbaa-cover.jpg',
  series:'NBAA · No Ballz At All',
  freeEntry:'One free play per wallet each week. Free-play prizes are awarded in House tokens.',
  bonus:'House-token bonus choices include EVO, Kaboom, King Joshi, Queen Joshi, KIND, and NBAA.'
};
export const gameRules = {
  '/spin-wheel': {
    name:'Spin Wheel',
    entry:'1 USDC on Base per spin. Up to 25 per purchase, 100 per wallet per day, and 500 per week.',
    rows:[['0–73','No win'],['74–88','$1 in ETH / 1 bonus token'],['89–92','$2 in ETH / 2 bonus tokens'],['93','$5 in ETH / 5 bonus tokens'],['94–99','Weekly jackpot entry']],
    headings:['Wheel stops','Paid result / free result'],
    notes:[paidEntrySplit, 'All 100 stops have equal weight. On-chain randomness determines the result. Free spins can earn jackpot entries and pay instant bonuses in the winner’s chosen House token.',
      'The weekly jackpot accrues $0.05 in ETH value per paid spin, plus rollover. A Sunday draw needs 2,000 paid spins and at least one jackpot entry. If either is missing, the jackpot carries forward.']
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
      'Under the funding schedule in the game brief, 100% of the first 5,600 paid pieces funds the prize reserve. At 2 USDC per piece, that is 11,200 USDC, enough to cover the first three sellout prizes. Later sales fund the remaining prize, donation and House allocations. Each later prize unlocks when funded.',
      'At a fully paid sellout, 40,000 USDC of gross funds 13,600 for donations, 13,200 for the House, and 13,200 in ETH prize value. Free pieces come from the same pool and add no revenue.',
      'The planned hunt publishes commitments to the shuffled order and hidden cell before sales, with the underlying values revealed at settlement. Each participating wallet may nominate one charity.',
      'If the funding gate is missed and sales stall for 180 days, the House may close the hunt and refund paid buyers in full.'
    ]
  },
  '/ballz-out': {
    ...nbaa,
    name:'Ballz Out',
    entry:'Planned price: 1 USDC per play. Make a 50/50 call on each step of a five-step double-or-nothing ladder.',
    headings:['Choice','Result'],
    rows:[['Correct call','Advance one step'],['Cash out','Take the current ladder prize after a successful step'],['Incorrect call','Lose the ladder prize for that play']],
    notes:[paidEntrySplit, 'Each step opens only when the player prize reserve can cover it.']
  },
  '/play-or-pass': {
    ...nbaa,
    name:'Play or Pass',
    entry:'Planned price: 1 USDC per play. Pick PLAY or PASS before a single draw from 0 to 99.',
    headings:['Choice','How it works'],
    rows:[['PLAY','Choose before the draw'],['PASS','Choose before the draw']],
    notes:[paidEntrySplit, 'The two choices are designed to have the same long-run payout. The number ranges and payout table will be published before launch.']
  },
  '/ballz-bingo': {
    ...nbaa,
    name:'Ballz Bingo',
    entry:'Planned price: 1 USDC per card. Balls are drawn one at a time until the first card fills.',
    headings:['Round state','Result'],
    rows:[['Below 6,000 paid cards','Round postpones and the pot carries forward'],['First full card','Wins the entire player pool plus the NBAA bonus pool']],
    notes:[paidEntrySplit, 'The NBAA bonus pool grows with each paid card.']
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
    '<p>Main prizes are shown in USD value and paid in ' + (game.prizeCurrency || 'ETH') + '. ' + (game.bonus || 'Bonuses use a House token of the winner’s choice.') + '</p>' +
    '<p><a href="/rules">Read the Arcade General Rules</a></p></section>' +
    (game.artwork ? '<section><h2>About NBAA</h2><p>NBAA is the series’ Cronos token.</p><img class="game-cover" src="' +
      game.artwork + '" width="1600" height="1600" loading="lazy" alt="No Ballz At All cover artwork"></section>' : '');
}
