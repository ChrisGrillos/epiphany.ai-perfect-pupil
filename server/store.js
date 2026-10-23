import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { entitySchemas, httpError } from './schemas.js';

export const LOCAL_USER = Object.freeze({ id: 'local-user', email: 'local@this-device', full_name: 'Local caretaker', role: 'user' });

export class Store {
  constructor(path) {
    this.path = path;
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) throw new Error('This database requires a newer Perfect Pupil version.');
    if (version < 1) this.db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE records (
        entity TEXT NOT NULL, id TEXT NOT NULL, owner TEXT NOT NULL,
        data TEXT NOT NULL CHECK(json_valid(data)),
        PRIMARY KEY(entity, id)
      ) STRICT;
      CREATE INDEX records_owner ON records(entity, owner);
      CREATE INDEX records_companion ON records(entity, json_extract(data, '$.companion_id'));
      CREATE INDEX records_session ON records(entity, json_extract(data, '$.session_id'));
      CREATE UNIQUE INDEX unique_run_request ON records(json_extract(data, '$.request_id')) WHERE entity='ModelRun';
      CREATE UNIQUE INDEX unique_achievement ON records(json_extract(data, '$.companion_id'), json_extract(data, '$.achievement_key')) WHERE entity='Achievement';
      CREATE UNIQUE INDEX unique_battle_result ON records(json_extract(data, '$.battle_id')) WHERE entity='BattleResult';
      CREATE TABLE secrets (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value))) STRICT;
      PRAGMA user_version=1;
      COMMIT;
    `);
    this.tail = Promise.resolve();
  }

  // Serialize commands and reads, including asynchronous handlers. A failed command rolls back all writes.
  exclusive(work, transaction = false) {
    const pending = this.tail.then(async () => {
      if (transaction) this.db.exec('BEGIN IMMEDIATE');
      try {
        const result = await work();
        if (transaction) this.db.exec('COMMIT');
        return result;
      } catch (error) {
        if (transaction) this.db.exec('ROLLBACK');
        throw error;
      }
    });
    this.tail = pending.catch(() => {});
    return pending;
  }

  assertEntity(entity) {
    if (!Object.hasOwn(entitySchemas, entity)) throw httpError('Unknown entity', 404);
  }

  list(entity, filters = {}, sort = 'created_date', limit, owner) {
    this.assertEntity(entity);
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw httpError('Invalid filter');
    let sql = 'SELECT data FROM records WHERE entity=?';
    const args = [entity];
    if (owner) { sql += ' AND owner=?'; args.push(owner); }
    for (const [key, value] of Object.entries(filters)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) || (value !== null && !['string', 'number', 'boolean'].includes(typeof value))) throw httpError('Invalid filter');
      sql += ' AND json_extract(data, ?) IS ?';
      args.push(`$.${key}`, typeof value === 'boolean' ? Number(value) : value);
    }
    const descending = String(sort).startsWith('-');
    const field = String(sort).replace(/^-/, '');
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) throw httpError('Invalid sort');
    sql += ` ORDER BY json_extract(data, ?) ${descending ? 'DESC' : 'ASC'}, rowid ${descending ? 'DESC' : 'ASC'}`;
    args.push(`$.${field}`);
    if (limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 20000) throw httpError('Invalid limit');
      sql += ' LIMIT ?'; args.push(limit);
    }
    return this.db.prepare(sql).all(...args).map(row => JSON.parse(row.data));
  }

  get(entity, id, owner) { return this.list(entity, { id }, undefined, 1, owner)[0] || null; }

  create(entity, input) {
    this.assertEntity(entity);
    const now = new Date().toISOString();
    const owner = input.is_temporary_ai ? 'system' : LOCAL_USER.id;
    const record = entitySchemas[entity].parse({ ...input, id: randomUUID(), owner_id: owner, created_by: owner, created_date: now, updated_date: now });
    this.validateReferences(entity, record);
    this.db.prepare('INSERT INTO records(entity,id,owner,data) VALUES(?,?,?,?)').run(entity, record.id, owner, JSON.stringify(record));
    return record;
  }

  update(entity, id, patch) {
    const current = this.get(entity, id);
    if (!current) throw httpError('Record not found', 404);
    const record = entitySchemas[entity].parse({ ...current, ...patch, id, owner_id: current.owner_id, created_by: current.created_by, created_date: current.created_date, updated_date: new Date().toISOString() });
    this.validateReferences(entity, record);
    this.db.prepare('UPDATE records SET data=? WHERE entity=? AND id=?').run(JSON.stringify(record), entity, id);
    return record;
  }

  validateReferences(entity, record) {
    if (record.companion_id && record.companion_id !== 'system' && !this.get('Companion', record.companion_id, LOCAL_USER.id)) throw httpError('Companion not found', 404);
    if (entity === 'ChatMessage') {
      const session = this.get('ChatSession', record.session_id, LOCAL_USER.id);
      if (!session || session.companion_id !== record.companion_id) throw httpError('Session does not belong to companion', 404);
    }
  }

  delete(entity, id) { this.assertEntity(entity); this.db.prepare('DELETE FROM records WHERE entity=? AND id=?').run(entity, id); }
  setting(key, fallback) { const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key); return row ? JSON.parse(row.value) : fallback; }
  setSetting(key, value) { this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); }
  close() { this.db.close(); }
}
