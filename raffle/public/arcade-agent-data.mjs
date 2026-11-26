export const origin = 'https://arcade.thehouseofjoshi.com';
export const siteName = 'House Arcade';
export const description = 'The House of Joshi’s game hub on Base, featuring House Raffle and upcoming games.';
export const contentSignal = 'search=yes, ai-input=yes, ai-train=no';

const page = (name, path) => ({name, url: origin + path});
export const pages = [
  page('House Arcade', '/'), page('House Raffle', '/raffle'), page('Raffle rules', '/how-it-works'),
  page('Arcade General Rules', '/rules'), page('Puzzle Print', '/puzzle-print'), page('Spin Wheel', '/spin-wheel'),
  page('Weekly Bingo', '/weekly-bingo'), page('Treasure Hunt', '/treasure-hunt'), page('About', '/about'),
  page('Contact', '/contact'), page('Help', '/help'), page('Privacy and wallet data', '/privacy')
];
const games = pages.slice(1, 2).concat(pages.slice(4, 8)).map((game, index) => ({
  ...game, status: index === 0 ? 'Public game; check the raffle page for the active round' : 'Coming Soon'
}));
export const arcadeTools = [
  {name:'list_arcade_games',description:'List the five House Arcade games, their public URLs, and availability.',read:() => games},
  {name:'get_arcade_links',description:'Find public Arcade rules, help, contact, privacy and game pages.',read:() => pages}
];
export const emptyInputSchema = {type:'object',properties:{},additionalProperties:false};
export const readOnlyAnnotations = {readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export function toolResult(tool) {
  return {content:[{type:'text',text:JSON.stringify(tool.read(),null,2)}]};
}
