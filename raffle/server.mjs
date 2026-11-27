import { listSupportReports, submitSupportReport } from './support.mjs';
import { homeMarkdown, llmsText, sitemap, structuredData, serverCard } from './agent-discovery.mjs';
import { origin, contentSignal } from './public/arcade-agent-data.mjs';
import { gameShowcase } from './game-showcase.mjs';
import { gameRules, upcomingRules } from './game-rules.mjs';
import { adminAuth, isAdmin } from './admin-auth.mjs';
import { enroll } from './local-enroll.mjs';
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

const hosted = process.env.HOUSE_ARCADE_HOSTED === '1';
const require = createRequire(import.meta.url);
const ethersBundle = resolve(dirname(require.resolve('ethers')), '../dist/ethers.min.js');
const artifact = JSON.parse(fs.readFileSync(new URL('./HouseRaffle.json', import.meta.url)));
const publicFile = path => new URL('./public/' + path, import.meta.url);
const arcadeFile = path => new URL('../' + path, import.meta.url);
const footer = fs.readFileSync(publicFile('footer.html'), 'utf8');
function pageContent(file) {
  return fs.readFileSync(file, 'utf8')
    .replace('<!-- arcade-footer -->', footer)
    .replace('<!-- arcade-json-ld -->', () => '<script type="application/ld+json">' +
      JSON.stringify(structuredData).replaceAll('<', '\\u003c') + '</script>')
    .replace(/(<title>)/i, '<link rel="icon" type="image/png" href="/arcade-favicon.png?v=3"><link rel="apple-touch-icon" href="/arcade-logo.png?v=3">$1')
    .replace(/(<a (?:href="\/" class="arcade-brand"|class="arcade-brand" href="\/")>)House Arcade<\/a>/, '$1<img src="/arcade-logo.png?v=3" alt="" width="36" height="36"><span>House Arcade</span></a>');
}
const roundFile = publicFile('round.json');
const mainnetRound = JSON.parse(fs.readFileSync(new URL('./round.mainnet.json', import.meta.url), 'utf8'));
const practiceGames = new Map([
  ['/ballz-out', '/ballz-out/practice'],
  ['/weekly-bingo', '/weekly-bingo/practice'],
  ['/spin-wheel', '/spin-wheel/practice'],
  ['/puzzle-print', '/puzzle-print/practice'],
  ['/treasure-hunt', '/treasure-hunt/practice']
]);
const agentResources = new Map([
  ['/index.md', ['text/markdown', homeMarkdown]],
  ['/llms.txt', ['text/plain', llmsText]],
  ['/sitemap.xml', ['application/xml', sitemap]],
  ['/.well-known/mcp/server-card.json', ['application/json', JSON.stringify(serverCard)]],
  ['/mcp/server-card', ['application/json', JSON.stringify(serverCard)]]
]);
const routes = new Map([
  ['/robots.txt', ['text/plain; charset=utf-8', publicFile('robots.txt')]],
  ['/about', ['text/html', publicFile('about.html')]],
  ['/contact', ['text/html', publicFile('contact.html')]],
  ['/webmcp.js', ['text/javascript', publicFile('webmcp.js')]],
  ['/arcade-agent-data.mjs', ['text/javascript', publicFile('arcade-agent-data.mjs')]],
  ...['arcade-logo.png', 'arcade-favicon.png', 'arcade-share.png'].map(name => ['/' + name, ['image/png', publicFile(name)]]),
  ['/puzzle-print/practice', ['text/html', publicFile('puzzle.html')]],
  ['/treasure-hunt/practice', ['text/html', publicFile('treasure-hunt.html')]],
  ['/puzzle.js', ['text/javascript', publicFile('puzzle.js')]],
  ['/puzzle-art.jpg', ['image/jpeg', publicFile('puzzle-art.jpg')]],
  ['/treasure-hunt.mjs', ['text/javascript', publicFile('treasure-hunt.mjs')]],
  ['/treasure-map.jpg', ['image/jpeg', publicFile('treasure-map.jpg')]],
  ['/spin-wheel/practice', ['text/html', publicFile('spin-wheel.html')]],
  ['/spin-wheel.css', ['text/css', publicFile('spin-wheel.css')]],
  ['/spin-wheel.mjs', ['text/javascript', publicFile('spin-wheel.mjs')]],
  ['/weekly-bingo/practice', ['text/html', publicFile('weekly-bingo.html')]],
  ['/weekly-bingo.css', ['text/css', publicFile('weekly-bingo.css')]],
  ['/weekly-bingo.mjs', ['text/javascript', publicFile('weekly-bingo.mjs')]],
  ['/ballz-out/practice', ['text/html', publicFile('ballz-out.html')]],
  ['/ballz-out.css', ['text/css', publicFile('ballz-out.css')]],
  ['/ballz-out.mjs', ['text/javascript', publicFile('ballz-out.mjs')]],
  ['/practice.css', ['text/css', publicFile('practice.css')]],
  ['/raffle-page.css', ['text/css', publicFile('raffle-page.css')]],
  ['/utc-time.js', ['text/javascript', publicFile('utc-time.js')]],
  ['/rules', ['text/html', publicFile('rules.html')]],
  ['/appkit.js', ['text/javascript', publicFile('generated/appkit.js')]],
  ['/nbaa-cover.jpg', ['image/jpeg', publicFile('nbaa-cover.jpg')]],
  ['/support-form.js', ['text/javascript', publicFile('support-form.js')]],
  ['/help', ['text/html', publicFile('help.html')]],
  ['/privacy', ['text/html', publicFile('privacy.html')]],
  ['/arcade-theme.css', ['text/css', publicFile('arcade-theme.css')]],
  ['/info.css', ['text/css', publicFile('info.css')]],
  ['/wallet-button.js', ['text/javascript', publicFile('wallet-button.js')]],
  ['/wallet-button.css', ['text/css', publicFile('wallet-button.css')]],
  ['/admin', ['text/html', publicFile('admin.html')]],
  ['/admin.js', ['text/javascript', publicFile('admin.js')]],
  ['/how-it-works', ['text/html', publicFile('how-it-works.html')]],
  ['/', ['text/html', publicFile(hosted ? 'arcade.html' : 'index.html')]],
  ['/raffle', ['text/html', publicFile('index.html')]],
  ['/wallet', ['text/html', publicFile('index.html')]],
  ['/wallet.js', ['text/javascript', publicFile('wallet.js')]],
  ['/ethers.js', ['text/javascript', ethersBundle]]
]);
for (const name of ['house-raffle-ticket-gold.svg', 'house-raffle-ticket-standard.svg']) {
  routes.set('/' + name, ['image/svg+xml', arcadeFile(name)]);
}

export function handleRequest(req, res) {
  const path = req.url.split('?')[0];
  if (hosted && path === '/') {
    res.setHeader('Vary', 'Accept');
    res.setHeader('Content-Signal', contentSignal);
    res.setHeader('Link', [
      '<' + origin + '/index.md>; rel="alternate"; type="text/markdown"',
      '<' + origin + '/llms.txt>; rel="describedby"; type="text/plain"',
      '<' + origin + '/sitemap.xml>; rel="sitemap"; type="application/xml"'
    ].join(', '));
    if (req.accepts?.(['text/html', 'text/markdown']) === 'text/markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.end(homeMarkdown);
      return;
    }
  }
  if (agentResources.has(path)) {
    const [type, content] = agentResources.get(path);
    res.setHeader('Content-Signal', contentSignal);
    res.setHeader('Content-Type', type + '; charset=utf-8');
    res.end(content);
    return;
  }
  if (path === '/support/report') {
    void submitSupportReport(req, res, hosted);
    return;
  }
  if (path === '/admin/support-reports') {
    if (!isAdmin(req)) {
      res.writeHead(401, {'Cache-Control':'no-store'}).end();
      return;
    }
    void listSupportReports(req, res);
    return;
  }
  if (path === '/admin/challenge' || path === '/admin/verify') {
    void adminAuth(req, res, path, hosted);
    return;
  }
  if (path === '/admin/treasure-hunt' || path === '/admin/puzzle-print') {
    res.writeHead(302, {Location:practiceGames.get(path.slice('/admin'.length))}).end();
    return;
  }
  if (Object.hasOwn(gameRules, path)) {
    const game = gameRules[path];
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(pageContent(publicFile('coming-soon.html'))
      .replaceAll('<!-- game-name -->', game.name)
      .replace('<!-- game-showcase -->', () => gameShowcase(path, game))
      .replace('<!-- practice-link -->', () => practiceGames.has(path) ?
        '<p><a class="wallet-button" href="' + practiceGames.get(path) + '">Play free practice</a> · No payments or prizes</p>' : '')
      .replace('<!-- game-rules -->', () => upcomingRules(game)));
    return;
  }
  if (path === '/admin' || path === '/admin.js') {
    res.setHeader('Cache-Control', 'no-store');
    if (!isAdmin(req)) {
      if (path === '/admin.js') { res.writeHead(401).end(); return; }
      res.setHeader('Content-Type', 'text/html');
      res.end(fs.readFileSync(publicFile('admin-login.html')));
      return;
    }
  }
  if (!hosted && path === '/local-enroll') {
    void enroll(req, res);
    return;
  }
  if (hosted && (path === '/house-raffle.html' || path === '/how-it-works.html')) {
    res.writeHead(302, {Location: path === '/house-raffle.html' ? '/raffle' : '/how-it-works'}).end();
    return;
  }
  if (path === '/abi.json' || path === '/round.json') {
    res.setHeader('Content-Type', 'application/json');
    if (path === '/abi.json') {
      res.end(JSON.stringify(artifact.abi));
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (hosted) {
      try {
        const configuredRound = process.env.PUBLIC_ROUND ? JSON.parse(process.env.PUBLIC_ROUND) : mainnetRound;
        const activeRound = configuredRound.chainId === 84532 ? mainnetRound : configuredRound;
        const {address, chainId, rpc, labels, deploymentBlock, paidSalesEnabled} = activeRound;
        if (address && (!/^0x[0-9a-f]{40}$/i.test(address) ||
            /^0x0{40}$/i.test(address) || chainId !== 8453 ||
            new URL(rpc).protocol !== 'https:' ||
            (deploymentBlock !== undefined && (!Number.isSafeInteger(deploymentBlock) || deploymentBlock < 0)))) throw new Error('Invalid PUBLIC_ROUND');
        const roundDefault = chainId === mainnetRound.chainId &&
          address?.toLowerCase() === mainnetRound.address.toLowerCase() &&
          mainnetRound.paidSalesEnabled === true;
        const salesEnabled = paidSalesEnabled === undefined ? roundDefault : paidSalesEnabled === true;
        res.end(JSON.stringify(address ? {address, chainId, rpc, labels, deploymentBlock, paidSalesEnabled: salesEnabled} : {}));
      } catch {
        res.writeHead(503).end(JSON.stringify({error:'The raffle round is unavailable.'}));
      }
      return;
    }
    res.end(process.env.LOCAL_ROUND ?? (fs.existsSync(roundFile) ? fs.readFileSync(roundFile) : '{}'));
    return;
  }
  const route = routes.get(path);
  if (!route) {
    res.writeHead(404).end();
    return;
  }
  const [type, file] = route;
  if (path === '/appkit.js' && !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', type);
  res.end(type === 'text/html' ? pageContent(file) : fs.readFileSync(file));
}

if (!hosted) {
  http.createServer(handleRequest).listen(Number(process.env.PORT || 14173), '127.0.0.1');
}
