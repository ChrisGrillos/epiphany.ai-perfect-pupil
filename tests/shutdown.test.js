import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { once } from 'node:events';
import { fixture } from './helpers.js';

test('shutdown closes browser preconnect sockets and can be awaited twice', async t => {
  const app = await fixture(t);
  const socket = connect({ host: '127.0.0.1', port: app.server.address().port });
  socket.on('error', () => {});
  await once(socket, 'connect');
  // No HTTP request: this reproduces a browser's speculative preconnect.
  const deadline = setTimeout(() => socket.destroy(), 2000);
  const started = performance.now();
  try {
    await app.close(); await app.close();
    assert.ok(performance.now() - started < 1500, 'shutdown must not wait for a preconnect to time out');
  } finally { clearTimeout(deadline); socket.destroy(); }
});
