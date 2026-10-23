import { getRuntime } from '../server/runtime.js';
import { saveProvider } from '../server/providers.js';
export default async function handler(req) {
  const { store } = getRuntime();
  return Response.json(await ({ success: true, config: saveProvider(store, await req.json()) }));
}
