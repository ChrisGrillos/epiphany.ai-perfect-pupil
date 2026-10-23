import { AsyncLocalStorage } from 'node:async_hooks';
import { LOCAL_USER } from './store.js';
import { entitySchemas } from './schemas.js';

const context = new AsyncLocalStorage();
export const withRuntime = (runtime, work) => context.run(runtime, work);
export function getRuntime() {
  const runtime = context.getStore();
  if (!runtime) throw new Error('No request runtime');
  return runtime;
}

export function createClientFromRequest() {
  const { store, generate } = getRuntime();
  function entities(service) {
    return Object.fromEntries(Object.keys(entitySchemas).map(name => [name, {
      list: async (sort, limit) => store.list(name, {}, sort, limit, service ? undefined : LOCAL_USER.id),
      filter: async (filters, sort, limit) => store.list(name, filters, sort, limit, service ? undefined : LOCAL_USER.id),
      create: async data => store.create(name, data),
      bulkCreate: async rows => rows.map(row => store.create(name, row)),
      update: async (id, data) => store.update(name, id, data),
      delete: async id => store.delete(name, id),
    }]));
  }
  return {
    auth: { me: async () => LOCAL_USER },
    entities: entities(false),
    service: { entities: entities(true), integrations: { Core: { InvokeLLM: generate } } },
  };
}
