import { getRuntime } from '../server/runtime.js';
export default async function handler() {
 const { store } = getRuntime();
 return Response.json({ success: true, tier: 'elite', local_edition: true, subscription: store.list('Subscription')[0], max_pupils_allowed: 20 });
}
