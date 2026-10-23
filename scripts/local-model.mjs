import { ensureLocalModel } from '../server/local-model.js';

const managed = await ensureLocalModel({ force: true });
console.log(`Local model ready: ${managed.installation.model_id} at ${managed.installation.endpoint}`);
if (managed.reused) console.log('Using the already running local model.');
else {
  managed.process.on('exit', code => { process.exitCode = code || 0; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => managed.process.kill());
}
