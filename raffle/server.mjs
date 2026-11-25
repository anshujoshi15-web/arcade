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
const roundFile = publicFile('round.json');
const routes = new Map([
  ['/how-it-works', ['text/html', publicFile('how-it-works.html')]],
  ['/', ['text/html', hosted ? arcadeFile('house-raffle.html') : publicFile('index.html')]],
  ['/wallet', ['text/html', publicFile('index.html')]],
  ['/wallet.js', ['text/javascript', publicFile('wallet.js')]],
  ['/ethers.js', ['text/javascript', ethersBundle]]
]);
if (hosted) {
  for (const name of ['house-raffle.html', 'how-it-works.html', 'house-raffle-ticket-gold.svg', 'house-raffle-ticket-standard.svg']) {
    routes.set('/' + name, [name.endsWith('.svg') ? 'image/svg+xml' : 'text/html', arcadeFile(name)]);
  }
}

export function handleRequest(req, res) {
  const path = req.url.split('?')[0];
  if (!hosted && path === '/local-enroll') {
    void enroll(req, res);
    return;
  }
  if (path === '/abi.json' || path === '/round.json') {
    const round = hosted ? process.env.PUBLIC_ROUND : process.env.LOCAL_ROUND;
    res.setHeader('Content-Type', 'application/json');
    res.end(path === '/abi.json' ? JSON.stringify(artifact.abi) :
      round ?? (fs.existsSync(roundFile) ? fs.readFileSync(roundFile) : '{}'));
    return;
  }
  const route = routes.get(path);
  if (!route) {
    res.writeHead(404).end();
    return;
  }
  const [type, file] = route;
  res.setHeader('Content-Type', type);
  const content = fs.readFileSync(file);
  const isHostedDemo = hosted && (path === '/' || path === '/house-raffle.html' || path === '/how-it-works.html');
  res.end(isHostedDemo ? content.toString().replaceAll('http://127.0.0.1:14173/', '/wallet') : content);
}

if (!hosted) {
  http.createServer(handleRequest).listen(Number(process.env.PORT || 14173), '127.0.0.1');
}
