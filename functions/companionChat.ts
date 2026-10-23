import { getRuntime } from '../server/runtime.js';
import { chat } from '../server/harness.js';
export default async function handler(req) {
  const { store } = getRuntime();
  return Response.json(await (chat(store, await req.json(), { signal: req.signal })));
}
