let sessionPromise;
let csrfToken;
export function localSession() {
  if (!sessionPromise) sessionPromise = fetch('/api/session', { cache: 'no-store', credentials: 'same-origin' }).then(async response => {
    if (!response.ok) throw new Error('The local Perfect Pupil service is unavailable. Start it with npm run dev.');
    const session = await response.json(); csrfToken = session.csrf_token; return session;
  }).catch(error => { sessionPromise = undefined; throw error; });
  return sessionPromise;
}
/** @param {string} path @param {{method?: string, body?: unknown, signal?: AbortSignal}} options */
export async function request(path, { method = 'GET', body, signal } = {}) {
  await localSession();
  const response = await fetch(path, { method, signal, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Pupil-CSRF': csrfToken }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { sessionPromise = undefined; csrfToken = undefined; }
    throw Object.assign(new Error(data.error || 'Local request failed'), { status: response.status });
  }
  return data;
}
/** @type {Record<string, {list: (sort?:string,limit?:number)=>Promise<any[]>, filter: (filter:object,sort?:string,limit?:number)=>Promise<any[]>, create:(body:object)=>Promise<any>, update:(id:string,body:object)=>Promise<any>, delete:(id:string)=>Promise<any>}>} */
const entities = new Proxy({}, { get: (_, name) => {
  const path = `/api/entities/${String(name)}`;
  return {
    list: (sort, limit) => request(`${path}?${new URLSearchParams({ ...(sort ? { sort } : {}), ...(limit ? { limit } : {}) })}`),
    filter: (filter, sort, limit) => request(`${path}?${new URLSearchParams({ filter: JSON.stringify(filter), ...(sort ? { sort } : {}), ...(limit ? { limit } : {}) })}`),
    create: body => request(path, { method: 'POST', body }),
    update: (id, body) => request(`${path}/${id}`, { method: 'PATCH', body }),
    delete: id => request(`${path}/${id}`, { method: 'DELETE', body: {} }),
  };
} });
export const pupil = {
  entities, auth: { me: () => request('/api/profile') },
  functions: { invoke: async (name, body = {}, options = {}) => {
    try { return { data: await request(`/api/functions/${name}`, { method: 'POST', body, ...options }) }; }
    catch (error) { if (error.name === 'AbortError') throw error; return { data: { error: error.message }, status: error.status }; }
  } },
};
