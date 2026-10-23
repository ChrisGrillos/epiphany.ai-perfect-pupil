import { spawnSync } from 'node:child_process';
import { httpError } from './schemas.js';

// Windows DPAPI binds saved credentials to the current Windows account. No plaintext key file.
function dpapi(value, decrypt = false) {
  if (process.platform !== 'win32') throw httpError('Saved API keys require Windows. Set PUPIL_CLOUD_API_KEY in the environment on other systems.');
  const action = decrypt ? 'Unprotect' : 'Protect';
  const script = `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::${action}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    input: decrypt ? value : Buffer.from(value).toString('base64'), encoding: 'utf8', windowsHide: true, timeout: 10000,
  });
  if (result.status !== 0) throw httpError('Windows credential protection failed. Re-enter the API key.', 500);
  return decrypt ? Buffer.from(result.stdout.trim(), 'base64').toString('utf8') : result.stdout.trim();
}

export function saveSecret(store, id, value) {
  store.db.prepare('INSERT INTO secrets VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(id, dpapi(value));
}
export function readSecret(store, id) {
  const row = id && store.db.prepare('SELECT value FROM secrets WHERE id=?').get(id);
  return row ? dpapi(row.value, true) : '';
}
export function deleteSecret(store, id) { if (id) store.db.prepare('DELETE FROM secrets WHERE id=?').run(id); }
export const protectSecret = value => dpapi(value);
export const unprotectSecret = value => dpapi(value, true);
export function publicConfig(config) {
  if (!config) return null;
  const { secret_id, api_key, ...safe } = config;
  return { ...safe, has_api_key: Boolean(secret_id || (safe.provider_name === 'cloud' && process.env.PUPIL_CLOUD_API_KEY)) };
}
