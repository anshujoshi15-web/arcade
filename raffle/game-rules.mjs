const eth = (value, currency = 'ETH') => '$' + value.toLocaleString('en-US', {maximumFractionDigits:2}) + ' in ' + currency;
const paidEntrySplit = 'Each 1 USDC paid entry is split into 0.34 USDC (34%) for donations, 0.33 USDC (33%) for the House, and 0.33 USDC (33%) for player prizes. Free entries add no funds to the split.';
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
    notes:['Trade duplicates to collect all 20 parts and uncover the hidden spot. The pieces burn on claim. The pool and hidden spot are committed before entries open.',
      'Claims open after 9,091 paid pieces, when the prize pool can cover the $6,000 first-place prize at 0.66 USDC per paid piece. Later places unlock as funded. At a fully paid sellout, 40,000 USDC of gross corresponds to 13,600 for the donation, 13,200 for the House, and 13,200 in ETH value for prizes.']
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
  return '<p>' + game.name + '</p><section><h2>Planned game rules</h2><p>' + game.entry + '</p>' +
    '<p>One free entry per wallet per week. No purchase is necessary. Players must be 18 or older.</p>' +
    '<table class="upcoming-prizes"><thead><tr>' +
    game.headings.map(label => '<th scope="col">' + label + '</th>').join('') +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    game.notes.map(note => '<p>' + note + '</p>').join('') +
    '<p>Main prizes are shown in USD value and paid in ' + (game.prizeCurrency || 'ETH') + '. Bonuses use a House token of the winner’s choice. The Arcade is in a soft opening, and this game has no public entries yet.</p>' +
    '<p><a href="/rules">Read the Arcade General Rules</a></p></section>';
}
