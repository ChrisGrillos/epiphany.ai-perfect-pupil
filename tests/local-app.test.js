import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from './helpers.js';
import { Store } from '../server/store.js';
import http from 'node:http';

test('local API requires a session, CSRF, same origin, and a loopback host', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.url}/api/profile`)).status, 401);
  assert.equal((await f.call('/api/functions/createCompanion', {}, 'POST', { 'X-Pupil-CSRF': '' })).status, 403);
  assert.equal((await f.call('/api/profile', undefined, 'GET', { Origin: 'https://attacker.invalid' })).status, 403);
  const hostileHost = await new Promise((resolve, reject) => {
    const request = http.get(`${f.url}/api/profile`, { headers: { ...f.headers, Host: 'attacker.invalid' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(hostileHost, 403);
  assert.equal((await f.call('/api/profile')).data.id, 'local-user');
});

test('onboarding creates a persistent companion, teenage roster and algorithm state', async t => {
  const f = await fixture(t); const companion = await f.create();
  assert.equal(companion.name, 'Nova');
  assert.equal((await f.call('/api/entities/PupilRoster')).data.length, 1);
  assert.equal((await f.call('/api/entities/AlgorithmState')).data.length, 1);
  assert.equal((await f.command('ensureCombatRoster', { companion_id: companion.id })).status, 200);
  assert.equal(f.store.list('PupilRoster').length, 1);
});

test('care, inventory use and achievements are server-authoritative and cannot be replayed for rewards', async t => {
  const f = await fixture(t); const companion = await f.create();
  assert.equal((await f.call(`/api/entities/Companion/${companion.id}`, { experience_points: 99999 }, 'PATCH')).status, 403);
  const fed = await f.command('applyCompanionAction', { companion_id: companion.id, action_type: 'feed' });
  assert.equal(fed.status, 200); assert.equal(fed.data.companion.hunger, 85);
  const repeated = await f.command('applyCompanionAction', { companion_id: companion.id, action_type: 'feed' });
  assert.ok(repeated.status >= 400 || repeated.data.error || repeated.data.cooldown_remaining);
  const unlocked = await f.command('checkAchievements', { companion_id: companion.id });
  assert.ok(unlocked.data.newly_unlocked.some(a => a.key === 'first_feed'));
  assert.equal((await f.command('checkAchievements', { companion_id: companion.id })).data.newly_unlocked.length, 0);
  const item = f.store.list('StoreItem').find(i => i.effect_type === 'hunger');
  const added = await f.command('addInventoryItem', { item_id: item.id });
  const used = await f.command('useInventoryItem', { inventory_id: added.data.id, companion_id: companion.id });
  assert.equal(used.data.companion.hunger, 100);
  assert.equal((await f.command('useInventoryItem', { inventory_id: added.data.id, companion_id: companion.id })).status, 404);
});

test('public memory/rule CRUD validates fields and companion references', async t => {
  const f = await fixture(t); const companion = await f.create();
  const memory = { companion_id: companion.id, memory_key: 'favorite_color', memory_value: 'blue', memory_type: 'preference' };
  assert.equal((await f.call('/api/entities/CompanionMemory', { ...memory, owner_id: 'someone-else' })).status, 400);
  assert.equal((await f.call('/api/entities/CompanionMemory', { ...memory, companion_id: 'missing' })).status, 404);
  const saved = await f.call('/api/entities/CompanionMemory', memory);
  assert.equal(saved.status, 200); assert.equal(saved.data.is_encrypted, false);
  assert.equal((await f.call(`/api/entities/CompanionMemory/${saved.data.id}`, { importance: 101 }, 'PATCH')).status, 400);
  assert.equal((await f.call(`/api/entities/CompanionMemory/${saved.data.id}`, { companion_id: 'missing' }, 'PATCH')).status, 400);
  const updated = await f.call(`/api/entities/CompanionMemory/${saved.data.id}`, { importance: 90 }, 'PATCH');
  assert.equal(updated.data.importance, 90);
  assert.equal((await f.call(`/api/entities/CompanionMemory/${saved.data.id}`, {}, 'DELETE')).status, 200);
});

test('SQLite survives reopening and rolls back multi-record failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pupil-store-'));
  let store;
  try {
    const path = join(directory, 'state.sqlite'); store = new Store(path);
    store.setSetting('kept', { value: 42 });
    await assert.rejects(store.exclusive(async () => { store.setSetting('rolled-back', true); store.create('Subscription', { tier: 'free' }); throw new Error('forced failure'); }, true));
    assert.equal(store.setting('rolled-back', null), null); assert.equal(store.list('Subscription').length, 0);
    store.close(); store = new Store(path);
    assert.equal(store.setting('kept', null).value, 42);
  } finally { store?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('encrypted brain export/import rejects wrong passphrases and round-trips memories', async t => {
  const f = await fixture(t); const companion = await f.create();
  const original = f.store.create('CompanionMemory', { companion_id: companion.id, memory_key: 'favorite_color', memory_value: 'blue', memory_type: 'preference' });
  const exported = await f.command('exportBrain', { companion_id: companion.id, passphrase: 'example-passphrase-123' });
  assert.equal(exported.status, 200); assert.ok(exported.data.brain_package.ciphertext_b64);
  assert.ok(!JSON.stringify(exported.data.brain_package).includes('favorite_color'));
  f.store.delete('CompanionMemory', original.id);
  const wrong = await f.command('importBrain', { companion_id: companion.id, passphrase: 'incorrect-password', brain_package: exported.data.brain_package });
  assert.ok(wrong.status >= 400); assert.equal(f.store.list('CompanionMemory').length, 0);
  const imported = await f.command('importBrain', { companion_id: companion.id, passphrase: 'example-passphrase-123', brain_package: exported.data.brain_package });
  assert.equal(imported.status, 200); assert.equal(f.store.list('CompanionMemory')[0].memory_value, 'blue');
});

test('teenage training combat resolves and finalizes rewards once', async t => {
  const f = await fixture(t); await f.create();
  const unit = f.store.list('PupilRoster')[0];
  const started = await f.command('startBattle', { battle_type: 'training_ai', mode: '1v1', team_a_ids: [unit.id], pcp_bet: 0 });
  assert.equal(started.status, 200);
  const battle = started.data.battle;
  assert.equal((await f.command('resumeBattle')).data.battle.id, battle.id);
  assert.equal((await f.command('startBattle', { battle_type: 'training_ai', mode: '1v1', team_a_ids: [unit.id] })).status, 409);
  assert.equal((await f.command('resolveBattleRound', { battle_id: battle.id, expected_round: 0, actions: [] })).status, 409);
  let status = battle.status;
  for (let round = 1; round <= 80 && status === 'in_progress'; round++) {
    const resolved = await f.command('resolveBattleRound', { battle_id: battle.id, expected_round: round, actions: [] });
    assert.equal(resolved.status, 200, JSON.stringify(resolved)); status = resolved.data.battle_status;
  }
  assert.equal(status, 'completed');
  const finalized = await f.command('finalizeBattle', { battle_id: battle.id });
  assert.equal(finalized.status, 200);
  const balance = f.store.list('UserCurrency')[0].pcp_balance;
  assert.equal((await f.command('finalizeBattle', { battle_id: battle.id })).data.already_finalized, true);
  assert.equal(f.store.list('UserCurrency')[0].pcp_balance, balance);
  assert.equal(f.store.list('PupilRoster').filter(r => r.is_temporary_ai).length, 0);
});

test('evolution preserves accumulated stats and unlocks a teenage combat roster', async t => {
  const f = await fixture(t); const companion = await f.create('child');
  // Arrange a near-milestone state through server storage, not a public stat-edit endpoint.
  f.store.update('Companion', companion.id, { experience_points: 450, personality_openness: 60 });
  const puzzle = await f.command('submitEvolutionPuzzle', { companion_id: companion.id, difficulty: 'easy', evolution_dna: {} });
  assert.equal(puzzle.status, 200);
  assert.ok(puzzle.data.companion.personality_openness >= 60);
  const evolution = await f.command('completeEvolution', { companion_id: companion.id, puzzle_id: puzzle.data.puzzle.id });
  assert.equal(evolution.status, 200); assert.equal(evolution.data.companion.stage, 'teenager');
  assert.equal(f.store.list('PupilRoster').length, 1);
});
