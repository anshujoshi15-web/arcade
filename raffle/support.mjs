import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const directory = resolve(process.env.ARCADE_SUPPORT_DIR || join(homedir(), '.house-arcade', 'support'));
const reportFile = /^\d{13}-[0-9a-f-]{36}\.json$/;
const recent = new Map();

function reply(res, status, payload) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(payload));
}

export async function submitSupportReport(req, res, hosted) {
  if (req.method !== 'POST') return reply(res, 405, {error:'Use POST.'});
  const origin = req.headers.origin || '';
  const allowed = hosted ? origin === 'https://arcade.thehouseofjoshi.com' : /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!allowed) return reply(res, 403, {error:'Open the form from the Arcade Help page.'});
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    return reply(res, 415, {error:'Use the Help form to submit a report.'});
  }
  const chunks = [];
  let size = 0;
  let fields;
  try {
    for await (const chunk of req.iterator({destroyOnReturn:false})) {
      size += chunk.length;
      if (size > 8192) {
        req.resume();
        return reply(res, 413, {error:'The report is too long.'});
      }
      chunks.push(chunk);
    }
    fields = JSON.parse(Buffer.concat(chunks));
  } catch {
    return reply(res, 400, {error:'Unable to read the report.'});
  }
  const {email, message, website} = fields || {};
  if (typeof email !== 'string' || email.length > 254 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      typeof message !== 'string' || message.trim().length < 10 || message.length > 1500 || website) {
    return reply(res, 400, {error:'Describe the issue in 10–1,500 characters and check your optional email address.'});
  }
  const now = Date.now();
  for (const [key, entry] of recent) if (entry.expires <= now) recent.delete(key);
  const key = req.socket.remoteAddress;
  const entry = recent.get(key) || {count:0, expires:now + 600_000};
  if (entry.count >= 10 || recent.size >= 1000) return reply(res, 429, {error:'Too many reports. Try again in a few minutes.'});
  entry.count++;
  recent.set(key, entry);
  const id = randomUUID();
  const file = join(directory, now + '-' + id + '.json');
  try {
    await mkdir(directory, {recursive:true, mode:0o700});
    await writeFile(file + '.tmp', JSON.stringify({id, createdAt:new Date(now).toISOString(), email, message:message.trim()}),
      {flag:'wx', mode:0o600});
    await rename(file + '.tmp', file);
    return reply(res, 201, {id});
  } catch (error) {
    console.error('Unable to save Arcade support report:', error.code);
    return reply(res, 503, {error:'The tracker could not save your report. Please email support instead.'});
  }
}

export async function listSupportReports(req, res) {
  if (req.method !== 'GET') return reply(res, 405, {error:'Use GET.'});
  try {
    const names = await readdir(directory);
    const latest = names.filter(name => reportFile.test(name)).sort().reverse().slice(0, 100);
    const reports = await Promise.all(latest.map(async name => JSON.parse(await readFile(join(directory, name), 'utf8'))));
    return reply(res, 200, {reports});
  } catch (error) {
    if (error.code === 'ENOENT') return reply(res, 200, {reports:[]});
    return reply(res, 503, {error:'The support reports could not be loaded.'});
  }
}
