const eth = value => '$' + value.toLocaleString('en-US', {maximumFractionDigits:2}) + ' in ETH';
export const gameRules = {
  '/spin-wheel': {
    name:'Spin Wheel',
    entry:'1 USDC on Base per spin. Up to 25 per purchase, 100 per wallet per day, and 500 per week.',
    rows:[['0–73','No win'],['74–88','$1 in ETH / 1 bonus token'],['89–92','$2 in ETH / 2 bonus tokens'],['93','$5 in ETH / 5 bonus tokens'],['94–99','Weekly jackpot entry']],
    headings:['Wheel stops','Paid result / free result'],
    notes:['All 100 stops have equal weight. On-chain randomness determines the result. Free spins can earn jackpot entries and pay instant bonuses in the winner’s chosen House token.',
      'The weekly jackpot accrues $0.05 in ETH value per paid spin, plus rollover. A Sunday draw needs 2,000 paid spins and at least one jackpot entry. If either is missing, the jackpot carries forward.']
  },
  '/weekly-bingo': {
    name:'Weekly Bingo',
    entry:'1 USDC on Base per card. Up to 10,000 cards per round, 25 per purchase, and 100 per wallet.',
    rows:[['6,000 paid cards',eth(1980)],['10,000 paid cards',eth(3300)]],
    headings:['Paid card count','Player pool'],
    notes:['The first full 75-ball bingo card wins the player pool. Each 5 × 5 NFT card has a free center. Cards that finish on the same ball split the pool equally.',
      'The scheduled live draw is Sunday at 7 p.m. Mountain Time. Below 6,000 paid cards the round is postponed. Sales stay open, cards stay valid, and the full pot carries forward. Purchases are final.']
  },
  '/treasure-hunt': {
    name:'Treasure Hunt',
    entry:'2 USDC per piece. There are 20 map designs with 1,000 copies each. Up to 25 per purchase, 50 held per wallet, and one claim per wallet.',
    rows:[6000,3200,2000,1200,800].map((value,index)=>[String(index+1),eth(value)]).concat([['Total',eth(13200)]]),
    headings:['Claim order','Prize at paid sellout'],
    notes:['Trade duplicates to collect all 20 parts and uncover the hidden spot. The pieces burn on claim. The pool and hidden spot are committed before entries open.',
      'Claims open at 5,600 paid pieces. Later places unlock as funded. At a fully paid sellout, 40,000 USDC of gross corresponds to 13,600 for the donation, 13,200 for the House, and 13,200 in ETH value for prizes.']
  },
  '/puzzle-print': {
    name:'Puzzle Print',
    entry:'$2 worth of crypto per piece. The pool has 25,000 pieces across 25 designs. Up to 25 pieces per transaction, 50 held, and one claim per wallet.',
    rows:[['1st',eth(5000)],['2nd',eth(4000)],['3rd',eth(3000)],['4th to 9th (each)',eth(642.86)],['10th',eth(642.84)],['Total',eth(16500)]],
    headings:['Claim order','Prize at paid sellout'],
    notes:['Trade duplicates and collect all 25 pieces. Claims burn the pieces and award the completed artwork as a token. Claims open after 6,000 paid pieces, funding the top three places first.',
      'At $50,000 paid gross, the split is $17,000 in crypto for the donation, $16,500 in crypto for the House, and $16,500 in ETH value for player prizes. Paid gross excludes free pieces.']
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
    '<p>Prize amounts are stated in dollars and planned for payment in ETH. Bonuses use a House token of the winner’s choice. The Arcade is in a soft opening, and this game has no public entries yet.</p>' +
    '<p><a href="/rules">Read the Arcade General Rules</a></p></section>';
}
