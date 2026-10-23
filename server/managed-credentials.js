import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDirectory } from './paths.js';
import { unprotectSecret } from './secrets.js';

let cached;
export async function managedCredential(config) {
  if (config.provider_name !== 'local') return '';
  const path = join(dataDirectory(), 'local-model/installation.json');
  let modified;
  try { modified = (await stat(path)).mtimeMs; } catch { return ''; }
  if (!cached || cached.path !== path || cached.modified !== modified) {
    const installation = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
    cached = { path, modified, installation, token: null };
  }
  const installation = cached.installation;
  if (config.model_name !== installation.model_id || config.api_endpoint !== installation.endpoint || !installation.protected_api_key) return '';
  if (!cached.token) cached.token = unprotectSecret(installation.protected_api_key);
  return cached.token;
}
