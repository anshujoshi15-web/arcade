export const origin = 'https://arcade.thehouseofjoshi.com';
export const siteName = 'House Arcade';
export const description = 'The House of Joshi’s game hub on Base, featuring House Raffle and upcoming games.';
export const contentSignal = 'search=yes, ai-input=yes, ai-train=no';

const page = (name, path) => ({name, url: origin + path});
const upcomingGames = [
  page('Puzzle Print', '/puzzle-print'), page('Spin Wheel', '/spin-wheel'),
  page('Weekly Bingo', '/weekly-bingo'), page('Treasure Hunt', '/treasure-hunt'),
  page('Ballz Out', '/ballz-out'), page('Play or Pass', '/play-or-pass'), page('Ballz Bingo', '/ballz-bingo')
];
const raffle = page('House Raffle', '/raffle');
export const pages = [
  page('House Arcade', '/'), raffle, page('Puzzle Print practice', '/puzzle-print/practice'),
  page('Play or Pass practice', '/play-or-pass/practice'), page('Ballz Out practice', '/ballz-out/practice'), page('Weekly Bingo practice', '/weekly-bingo/practice'), page('Spin Wheel practice', '/spin-wheel/practice'), page('Treasure Hunt practice', '/treasure-hunt/practice'), page('Raffle rules', '/how-it-works'),
  page('Arcade General Rules', '/rules'), ...upcomingGames, page('About', '/about'),
  page('Contact', '/contact'), page('Help', '/help'), page('Privacy and wallet data', '/privacy')
];
const games = [
  {...raffle, status:'Public game; check the raffle page for the active round'},
  ...upcomingGames.map(game => ({
    ...game,
    status:['Puzzle Print','Spin Wheel','Treasure Hunt','Weekly Bingo','Ballz Out','Play or Pass'].includes(game.name) ? 'Free practice available; prize rounds Coming Soon' : 'Coming Soon'
  }))
];
export const arcadeTools = [
  {name:'list_arcade_games',description:'List the House Arcade games, their public URLs, and availability.',read:() => games},
  {name:'get_arcade_links',description:'Find public Arcade rules, help, contact, privacy and game pages.',read:() => pages}
];
export const emptyInputSchema = {type:'object',properties:{},additionalProperties:false};
export const readOnlyAnnotations = {readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export function toolResult(tool) {
  return {content:[{type:'text',text:JSON.stringify(tool.read(),null,2)}]};
}
