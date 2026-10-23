import { spawn } from 'node:child_process';
import { ensureLocalModel } from '../server/local-model.js';

const model = await ensureLocalModel();
const api = spawn(process.execPath, ['--env-file-if-exists=.env.local', 'server/index.js'], { stdio: 'inherit', windowsHide: true });
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true; api.kill(); model?.process?.kill(); process.exitCode = code;
}
api.on('error', () => stop(1)); api.on('exit', code => stop(code || 0));
model?.process?.on('exit', () => stop(1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
