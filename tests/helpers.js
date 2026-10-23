import { createApp } from '../server/index.js';

export async function fixture(t, options = {}) {
  const app = await createApp({ databasePath: ':memory:', ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const session = await fetch(`${url}/api/session`);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const { csrf_token } = await session.json();
  const headers = { Cookie: cookie, 'X-Pupil-CSRF': csrf_token, 'Content-Type': 'application/json' };
  const call = async (path, body, method = body === undefined ? 'GET' : 'POST', extra = {}) => {
    const response = await fetch(`${url}${path}`, { method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  const command = (name, body = {}) => call(`/api/functions/${name}`, body);
  const create = async (stage = 'teenager', name = 'Nova') => {
    const response = await command('createCompanion', { name, stage, species: 'celestial' });
    if (response.status !== 200) throw new Error(JSON.stringify(response));
    return response.data.companion;
  };
  return { ...app, url, headers, call, command, create };
}

export function modelResponse(value = { response: 'Hello, caretaker.', emotion: 'curious', new_memory: null, memories_referenced: [] }) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 100, completion_tokens: 20 } });
}
