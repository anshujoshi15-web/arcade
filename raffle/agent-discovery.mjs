import {origin, siteName, description, pages, arcadeTools, emptyInputSchema, readOnlyAnnotations} from './public/arcade-agent-data.mjs';

const linkList = items => items.map(item => '- [' + item.name + '](' + item.url + ')' +
  (item.status ? ' — ' + item.status : '')).join('\n');
const organizationId = origin + '/#organization';
const websiteId = origin + '/#website';
const games = arcadeTools[0].read();
export const homeMarkdown = [
  '# ' + siteName, description, '## Games', linkList(games), '## Entry and rules',
  'House Raffle tickets are ERC-721 NFTs on Base. A paid ticket costs 1 USDC when paid entry is open, and eligible wallets can claim one free entry per week. Main prizes are quoted in dollars and paid in Base ETH. Check the round page for current availability.',
  linkList(pages.filter(page => !games.some(game => game.url === page.url) && page.url !== origin + '/')), ''
].join('\n\n');
export const llmsText = [
  '# ' + siteName, '> ' + description,
  'The raffle page provides current round status. The other four games are Coming Soon. Agent tools supply public links and game availability.',
  '## Public pages', linkList(pages), '## Agent resources',
  linkList([{name:'Homepage Markdown',url:origin+'/index.md'},{name:'Sitemap',url:origin+'/sitemap.xml'},
    {name:'MCP server card',url:origin+'/.well-known/mcp/server-card.json'}]), ''
].join('\n\n');
export const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.map(page => '  <url><loc>' + page.url + '</loc></url>').join('\n') + '\n</urlset>\n';

export const structuredData = {
  '@context':'https://schema.org',
  '@graph':[
    {
      '@type':'Organization','@id':organizationId,name:'The House of Joshi',
      url:'https://thehouseofjoshi.com/',logo:origin+'/arcade-logo.png',
      email:'support@thehouseofjoshi.com',
      contactPoint:{'@type':'ContactPoint',contactType:'customer support',email:'support@thehouseofjoshi.com',url:origin+'/contact'},
      sameAs:['https://x.com/thehouseofjoshi','https://www.instagram.com/thehouseofjoshi','https://discord.com/invite/uH9zVeAwDu']
    },
    {'@type':'WebSite','@id':websiteId,name:siteName,url:origin+'/',description,publisher:{'@id':organizationId},inLanguage:'en'},
    {'@type':'WebPage','@id':origin+'/#homepage',name:siteName,url:origin+'/',isPartOf:{'@id':websiteId},mainEntity:{'@id':origin+'/#games'}},
    {'@type':'ItemList','@id':origin+'/#games',name:'House Arcade games',
      itemListElement:games.map((game,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Game',name:game.name,url:game.url,description:game.status}}))}
  ]
};
export const serverInfo = {name:'house-arcade',title:siteName,version:'1.0.0'};
export const serverCard = {
  $schema:'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
  version:'1.0',
  protocolVersion:'2025-11-25',
  serverInfo,
  description,
  documentationUrl:origin+'/llms.txt',
  transport:{type:'streamable-http',endpoint:origin+'/mcp'},
  capabilities:{tools:{listChanged:false}},
  tools:arcadeTools.map(({name,description})=>({name,description,inputSchema:emptyInputSchema,annotations:readOnlyAnnotations}))
};
