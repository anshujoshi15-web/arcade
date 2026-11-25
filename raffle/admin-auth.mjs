import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { verifyMessage } from 'ethers';

export const HOUSE_WALLET = '0x6736d2ea9807297f0e56967361b9410854b86a5f';
const secret = randomBytes(32);
const challenges = new Map();
const cookie = 'house_admin_session';
const sessionSeconds = 900;
const sign = value => createHmac('sha256', secret).update(value).digest('hex');

export function isAdmin(req) {
  const value = (req.headers.cookie || '').split(/; */).find(part => part.startsWith(cookie + '='));
  if (!value) return false;
  const [expiry, nonce, signature] = value.slice(cookie.length + 1).split('.');
  if (!/^\d+$/.test(expiry) || !/^[a-f0-9]{48}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return Number(expiry) > Date.now() &&
    timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(expiry + '.' + nonce), 'hex'));
}

function reply(res, code, body) {
  res.writeHead(code, {'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}

export async function adminAuth(req, res, path, hosted) {
  if (req.method !== 'POST') return reply(res, 405, {error:'Use POST.'});
  const now = Date.now();
  if (path.endsWith('/challenge')) {
    for (const [nonce, entry] of challenges) if (entry.expiry <= now) challenges.delete(nonce);
    if (challenges.size >= 1024) return reply(res, 429, {error:'Too many pending sign-ins. Try again shortly.'});
    const nonce = randomBytes(24).toString('hex');
    const expiry = now + 120000;
    const origin = req.headers.origin;
    if (!origin || (hosted ? origin !== 'https://arcade.thehouseofjoshi.com' :
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      return reply(res, 403, {error:'Open the admin page from the arcade site.'});
    }
    const message = ['House Arcade admin sign-in', origin, 'Wallet: ' + HOUSE_WALLET,
      'Nonce: ' + nonce, 'Expires: ' + new Date(expiry).toISOString(),
      'This signature authorizes an admin session only.'].join('\n');
    challenges.set(nonce, {message, expiry, origin});
    return reply(res, 200, {nonce, message});
  }
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2048) throw new Error('Invalid request.');
    }
    const {nonce, signature} = JSON.parse(body);
    const entry = challenges.get(nonce);
    if (!entry || entry.expiry <= now || entry.origin !== req.headers.origin) {
      return reply(res, 401, {error:'The sign-in request expired. Try again.'});
    }
    challenges.delete(nonce);
    if (verifyMessage(entry.message, signature).toLowerCase() !== HOUSE_WALLET) {
      return reply(res, 403, {error:'Only the House wallet can sign in.'});
    }
    const session = (now + sessionSeconds * 1000) + '.' + randomBytes(24).toString('hex');
    res.setHeader('Set-Cookie', cookie + '=' + session + '.' + sign(session) +
      '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + sessionSeconds + (hosted ? '; Secure' : ''));
    return reply(res, 200, {ok:true});
  } catch {
    return reply(res, 400, {error:'Invalid wallet signature or request.'});
  }
}
