import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureLocalModel } from '../server/local-model.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const model = await ensureLocalModel();
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env.local', 'server/index.js'], { cwd: root, stdio: 'inherit', windowsHide: true }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); model?.process?.kill(); process.exitCode = code; }
model?.process?.on('exit', () => stop(1));
for (const child of children) { child.on('error', () => stop(1)); child.on('exit', code => stop(code || 0)); }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
// Do not present the frontend before the storage service is reachable.
let ready = false;
for (let attempt = 0; attempt < 20 && !stopping; attempt++) {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PUPIL_PORT || 4318}/api/health`, { signal: AbortSignal.timeout(1000) });
    if (response.ok) { ready = true; break; }
  } catch { /* Server is still starting. */ }
  await new Promise(resolve => setTimeout(resolve, 250));
}
if (!ready) { console.error('The local service did not become ready. Check the API port and data directory.'); stop(1); }
else if (!stopping) {
  const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: root, stdio: 'inherit', windowsHide: true });
  children.push(web); web.on('error', () => stop(1)); web.on('exit', code => stop(code || 0));
}
