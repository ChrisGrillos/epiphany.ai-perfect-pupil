import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, sep, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dataDirectory } from './paths.js';
import { z } from 'zod';
import { Store, LOCAL_USER } from './store.js';
import { withRuntime } from './runtime.js';
import { httpError, publicWriteSchemas } from './schemas.js';
import { activeConfig, saveProvider, legacyGenerator, requestCompletion } from './providers.js';
import { publicConfig } from './secrets.js';
import { chat, HARNESS_VERSION } from './harness.js';
import { exportDataset, reviewRun, registerModel } from './training.js';
import { addInventoryItem, useInventoryItem } from './commands.js';
import { seedStore } from './catalog.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMMANDS = ['createCompanion', 'applyCompanionAction', 'applyNotepadCustomization', 'checkAchievements', 'completeEvolution', 'ensureCombatRoster', 'exportBrain', 'importBrain', 'finalizeBattle', 'getEntitlements', 'resolveBattleRound', 'setEvolutionPath', 'setSubscriptionTier', 'startBattle', 'submitEvolutionPuzzle'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export { dataDirectory } from './paths.js';

export async function createApp({ databasePath = join(dataDirectory(), 'pupil.sqlite'), fetcher = fetch, devPort = Number(process.env.PUPIL_WEB_PORT || 5173) } = {}) {
  const store = new Store(databasePath);
  seedStore(store);
  const handlers = Object.fromEntries(await Promise.all(COMMANDS.map(async name => [name, (await import(`../functions/${name}.ts`)).default])));
  const sessionToken = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  const controllers = new Set();
  const constantEquals = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  function json(res, status, body, extra = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
    res.end(JSON.stringify(body));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    let controller;
    try {
      let host;
      try { host = new URL(`http://${req.headers.host}`); } catch { throw httpError('Invalid host', 403); }
      if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) throw httpError('Only loopback hosts are supported', 403);
      const port = server.address()?.port;
      if (![String(port), String(devPort)].includes(host.port)) throw httpError('Invalid host port', 403);
      const url = new URL(req.url, host);
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin) {
          let origin;
          try { origin = new URL(req.headers.origin); } catch { throw httpError('Invalid origin', 403); }
          if (origin.protocol !== 'http:' || origin.host !== host.host) throw httpError('Cross-origin API requests are blocked', 403);
        }
        if (req.headers['sec-fetch-site'] === 'cross-site') throw httpError('Cross-site requests are blocked', 403);
        if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { status: 'ok', harness_version: HARNESS_VERSION, edition: 'local' });
        if (url.pathname === '/api/session' && req.method === 'GET') return json(res, 200, { user: LOCAL_USER, csrf_token: csrf, data_path: databasePath, local_edition: true }, { 'Set-Cookie': `pupil_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/` });
        const cookie = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('pupil_session='))?.slice(14);
        if (!constantEquals(cookie, sessionToken)) throw httpError('Local session expired. Refresh the app.', 401);
        if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) throw httpError('Method not allowed', 405);
        if (req.method !== 'GET' && !constantEquals(req.headers['x-pupil-csrf'], csrf)) throw httpError('Invalid local request token', 403);
        let body = {};
        if (req.method !== 'GET') {
          if (!req.headers['content-type']?.startsWith('application/json')) throw httpError('JSON content type required', 415);
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 3 * 1024 * 1024) throw httpError('Request exceeds 3 MiB', 413);
            chunks.push(chunk);
          }
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw httpError('Invalid JSON'); }
        }
        controller = new AbortController(); controllers.add(controller);
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        const signal = controller.signal;
        const result = await store.exclusive(async () => {
          if (signal.aborted) throw httpError('Request cancelled', 499);
          return withRuntime({ store, signal, generate: legacyGenerator(store, signal, fetcher) }, async () => {
            if (url.pathname === '/api/profile' && req.method === 'GET') return LOCAL_USER;
            if (url.pathname === '/api/settings' && req.method === 'GET') return { ...store.setting('preferences', {}), data_path: databasePath, storage_encrypted: false, credential_protection: process.platform === 'win32' ? 'Windows DPAPI' : 'environment only' };
            if (url.pathname === '/api/settings' && req.method === 'PATCH') {
              const preferences = z.object({ notifications: z.boolean(), soundEffects: z.boolean(), darkMode: z.boolean(), privacyMode: z.boolean() }).strict().parse(body);
              store.setSetting('preferences', preferences); return preferences;
            }
            const entityMatch = url.pathname.match(/^\/api\/entities\/([A-Za-z]+)(?:\/([a-zA-Z0-9-]+))?$/);
            if (entityMatch) {
              const [, entity, id] = entityMatch; store.assertEntity(entity);
              if (req.method === 'GET') {
                let filter;
                try { filter = JSON.parse(url.searchParams.get('filter') || '{}'); } catch { throw httpError('Invalid filter'); }
                let rows = id ? [store.get(entity, id, LOCAL_USER.id)].filter(Boolean) : store.list(entity, filter, url.searchParams.get('sort') || undefined, url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined, LOCAL_USER.id);
                if (entity === 'AIProviderConfig') rows = rows.map(publicConfig);
                if (entity === 'ModelRun') rows = rows.map(({ messages, result, ...row }) => ({ ...row, input_context: messages }));
                return rows;
              }
              const schema = publicWriteSchemas[entity];
              if (!schema) throw httpError('Use an application command to change this entity', 403);
              if (id && !store.get(entity, id, LOCAL_USER.id)) throw httpError('Record not found', 404);
              if (req.method === 'DELETE' && id) { store.delete(entity, id); return { success: true }; }
              if (req.method === 'POST' && !id) return store.create(entity, schema.parse(body));
              if (req.method === 'PATCH' && id) return store.update(entity, id, schema.omit({ companion_id: true }).partial().parse(body));
              throw httpError('Method not allowed', 405);
            }
            const commandMatch = url.pathname.match(/^\/api\/functions\/([A-Za-z]+)$/);
            if (commandMatch && req.method === 'POST') {
              const name = commandMatch[1];
              if (name === 'companionChat') return chat(store, body, { signal, fetcher });
              if (name === 'saveAIProviderConfig') return { success: true, config: saveProvider(store, body) };
              if (name === 'testAIProvider') {
                const config = activeConfig(store);
                if (config.provider_name === 'builtin') return { success: true, message: 'Basic companion mode is ready. No language model is connected.' };
                const response = await requestCompletion(store, config, [{ role: 'system', content: 'Return exactly a JSON object with ok set to true.' }, { role: 'user', content: 'Connection test' }], signal, fetcher);
                if (response.value.ok !== true) throw httpError('The model did not pass the JSON connection test.', 502);
                return { success: true, message: 'Model connection and JSON response verified.' };
              }
              if (name === 'reviewModelRun') { const row = reviewRun(store, body); return { id: row.id, review: row.review, training_allowed: row.training_allowed }; }
              if (name === 'exportTrainingDataset') return exportDataset(store);
              if (name === 'registerModel') return registerModel(store, body);
              if (name === 'addInventoryItem') return addInventoryItem(store, body);
              if (name === 'useInventoryItem') return useInventoryItem(store, body);
              if (name === 'resumeBattle') {
                const battle = store.list('Battle', { status: 'in_progress' }, '-created_date', 1, LOCAL_USER.id)[0];
                if (!battle) return { battle: null };
                return { battle, team_a: battle.team_a.map(id => store.get('PupilRoster', id)).filter(Boolean), team_b: battle.team_b.map(id => store.get('PupilRoster', id)).filter(Boolean), turns: store.list('BattleTurn', { battle_id: battle.id }) };
              }
              if (name === 'newChatSession') return store.create('ChatSession', { ...z.object({ companion_id: z.string() }).strict().parse(body), title: 'Companion conversation', is_imported: false });
              if (!Object.hasOwn(handlers, name)) throw httpError('Unknown command', 404);
              const response = await handlers[name](new Request('http://localhost/command', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, signal }));
              const data = await response.json();
              if (!response.ok || data.error) throw httpError(data.error || 'Command failed', response.ok ? 400 : response.status);
              return data;
            }
            throw httpError('API route not found', 404);
          });
        }, req.method !== 'GET');
        if (!res.destroyed) json(res, 200, result);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError('Method not allowed', 405);
      const root = join(ROOT, 'dist');
      const requested = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (requested !== root && !requested.startsWith(root + sep)) throw httpError('Not found', 404);
      let file = requested;
      try { if (!(await stat(file)).isFile()) file = join(root, 'index.html'); } catch { file = join(root, 'index.html'); }
      if (!existsSync(file)) throw httpError('Build the frontend with npm run build, or use npm run dev.', 503);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : error.status || 500;
      const message = error instanceof z.ZodError ? error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : error.status ? error.message : 'The local service could not complete this request.';
      if (!res.headersSent && !res.destroyed) json(res, status, { error: message });
    } finally { if (controller) controllers.delete(controller); }
  });
  server.requestTimeout = 60000;
  let closing;
  return { server, store, close: () => closing ||= (async () => {
    for (const c of controllers) c.abort();
    const stopped = new Promise(done => server.close(done));
    // Browser preconnect sockets may never send HTTP headers and can keep close()
    // pending indefinitely. Abort requests, close sockets, then drain transactions.
    server.closeAllConnections();
    await stopped; await store.tail; store.close();
  })() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = await createApp();
  const port = Number(process.env.PUPIL_PORT || 4318);
  app.server.listen(port, '127.0.0.1', () => console.log(`Perfect Pupil: http://127.0.0.1:${port}\nLocal data: ${app.store.path}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.close().then(() => process.exit(0)));
}
