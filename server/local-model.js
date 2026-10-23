import { readFile, access, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { dataDirectory } from './paths.js';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { protectSecret, unprotectSecret } from './secrets.js';
import { Store } from './store.js';
import { activeConfig } from './providers.js';

export async function ensureLocalModel({ force = false } = {}) {
  let installation;
  const directory = join(dataDirectory(), 'local-model');
  try { installation = JSON.parse((await readFile(join(directory, 'installation.json'), 'utf8')).replace(/^\uFEFF/, '')); }
  catch { if (force) throw new Error('Run npm run model:setup first.'); return null; }
  if (!force) {
    if (!installation.auto_start) return null;
    const store = new Store(join(dataDirectory(), 'pupil.sqlite'));
    try {
      const config = activeConfig(store);
      if (config.provider_name !== 'local' || config.model_name !== installation.model_id || config.api_endpoint !== installation.endpoint) return null;
    } finally { store.close(); }
  }
  if (!installation.protected_api_key) {
    installation.protected_api_key = protectSecret(randomBytes(32).toString('hex'));
    await writeFile(join(directory, 'installation.json'), JSON.stringify(installation, null, 2));
  }
  const token = unprotectSecret(installation.protected_api_key);
  const base = installation.endpoint.replace(/\/v1\/?$/, '');
  try {
    const response = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      const data = await response.json();
      if (data.data?.some(model => model.id === installation.model_id)) return { process: null, installation, reused: true };
      throw new Error('Port 8080 serves another model. Keep that server intact and choose another endpoint.');
    }
    throw new Error(`Port 8080 is already occupied (HTTP ${response.status}). Stop that server or choose another endpoint.`);
  } catch (error) { if (error.message.startsWith('Port 8080')) throw error; }
  await access(installation.executable); await access(installation.model_path);
  await mkdir(directory, { recursive: true });
  const log = await open(join(directory, 'server.log'), 'a');
  const args = [
    '--model', installation.model_path, '--alias', installation.model_id,
    '--host', '127.0.0.1', '--port', '8080',
    '--ctx-size', String(installation.context_tokens), '--n-gpu-layers', String(installation.gpu_layers),
    '--parallel', '1', '--batch-size', String(installation.batch), '--ubatch-size', String(installation.ubatch),
    '--threads', '6', '--flash-attn', 'on', '--reasoning', 'off', '--reasoning-budget', '0',
    '--chat-template-kwargs', JSON.stringify({ enable_thinking: false }),
    '--no-webui', '--no-slots', '--threads-http', '2',
  ];
  const child = spawn(installation.executable, args, { cwd: directory, windowsHide: true, stdio: ['ignore', log.fd, log.fd], env: { ...process.env, LLAMA_API_KEY: token } });
  await log.close();
  let failure;
  child.on('error', error => { failure = error; });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (failure || child.exitCode !== null) throw failure || new Error(`Local model exited (${child.exitCode}); see ${join(directory, 'server.log')}`);
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return { process: child, installation, reused: false };
    } catch { /* CUDA/model startup is still in progress. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error(`Local model did not become ready; see ${join(directory, 'server.log')}`);
}
