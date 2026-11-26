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
    .replace(/(<title>)/i, '<link rel="icon" type="image/png" href="/arcade-favicon.png"><link rel="apple-touch-icon" href="/arcade-logo.png">$1')
    .replace(/(<a (?:href="\/" class="arcade-brand"|class="arcade-brand" href="\/")>)House Arcade<\/a>/, '$1<img src="/arcade-logo.png" alt="" width="32" height="32">House Arcade</a>');
}
const roundFile = publicFile('round.json');
const mainnetRound = JSON.parse(fs.readFileSync(new URL('./round.mainnet.json', import.meta.url), 'utf8'));
const upcoming = new Set(Object.keys(gameRules));
const previewAssets = new Set(['/puzzle.js', '/puzzle-art.jpg', '/game-preview.js']);
const routes = new Map([
  ...['arcade-logo.png', 'arcade-favicon.png', 'arcade-share.png'].map(name => ['/' + name, ['image/png', publicFile(name)]]),
  ['/raffle-page.css', ['text/css', publicFile('raffle-page.css')]],
  ['/utc-time.js', ['text/javascript', publicFile('utc-time.js')]],
  ['/rules', ['text/html', publicFile('rules.html')]],
  ['/appkit.js', ['text/javascript', publicFile('generated/appkit.js')]],
  ['/spin-wheel', ['text/html', publicFile('game-preview.html')]],
  ['/weekly-bingo', ['text/html', publicFile('game-preview.html')]],
  ['/treasure-hunt', ['text/html', publicFile('game-preview.html')]],
  ['/game-preview.js', ['text/javascript', publicFile('game-preview.js')]],
  ['/help', ['text/html', publicFile('help.html')]],
  ['/privacy', ['text/html', publicFile('privacy.html')]],
  ['/arcade-theme.css', ['text/css', publicFile('arcade-theme.css')]],
  ['/info.css', ['text/css', publicFile('info.css')]],
  ['/wallet-button.js', ['text/javascript', publicFile('wallet-button.js')]],
  ['/wallet-button.css', ['text/css', publicFile('wallet-button.css')]],
  ['/puzzle-print', ['text/html', publicFile('puzzle.html')]],
  ['/puzzle.js', ['text/javascript', publicFile('puzzle.js')]],
  ['/puzzle-art.jpg', ['image/jpeg', publicFile('puzzle-art.jpg')]],
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
  if (path === '/admin/challenge' || path === '/admin/verify') {
    void adminAuth(req, res, path, hosted);
    return;
  }
  if (upcoming.has(path) || previewAssets.has(path)) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!isAdmin(req)) {
      if (previewAssets.has(path)) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', 'text/html');
      res.end(pageContent(publicFile('coming-soon.html')).replace('<!-- game-rules -->', () => upcomingRules(gameRules[path])));
      return;
    }
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
