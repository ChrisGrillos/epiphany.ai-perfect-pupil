import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'] });
function uniqueStrings(values) { return Array.from(new Set(values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))); }
function buildUserOwnerKeys(user) { return uniqueStrings([user?.id, user?.user_id, user?.sub, user?.email]); }
function getCanonicalOwnerKey(user) { return user?.id || user?.email || null; }
function extractEntityOwner(entity) { if (!entity) return null; for (const key of SCHEMA_ASSUMPTIONS.ownerFields) { if (typeof entity[key] === 'string' && entity[key].trim()) return entity[key].trim(); } return null; }
function ownerMatches(owner, ownerKeys) { return owner ? ownerKeys.includes(owner) : false; }
function dedupeById(rows) { const out = []; const seen = new Set(); for (const row of rows || []) { const id = String(row?.id || ''); if (!id || seen.has(id)) continue; seen.add(id); out.push(row); } return out; }
async function tryFilterMany(ea, filters) { const rows = []; for (const f of filters) { try { const res = await ea.filter(f); if (Array.isArray(res)) rows.push(...res); } catch {} } return dedupeById(rows); }
async function getOwnedRecordById(base44, entityName, id, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.[entityName]; const usr = base44?.entities?.[entityName];
  if (svc?.filter) { try { const rows = await svc.filter({ id }); const row = Array.isArray(rows) ? rows[0] : null; if (!row) return null; const owner = extractEntityOwner(row); if (!owner) { if (usr?.filter) { const sr = await usr.filter({ id }); return Array.isArray(sr) && sr.length > 0 ? row : null; } return null; } return ownerMatches(owner, ownerKeys) ? row : null; } catch {} }
  if (usr?.filter) { try { const rows = await usr.filter({ id }); return Array.isArray(rows) && rows.length > 0 ? rows[0] : null; } catch {} }
  return null;
}
async function getUserCurrencyRecord(base44, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.UserCurrency;
  const ownerFilters = ownerKeys.flatMap(k => SCHEMA_ASSUMPTIONS.ownerFields.map(f => ({ [f]: k })));
  if (svc?.filter) { const rows = await tryFilterMany(svc, ownerFilters); if (rows.length > 0) return rows[0]; }
  return null;
}
function createSecureSeed() { const arr = new Uint32Array(1); crypto.getRandomValues(arr); return arr[0]; }
function buildDeterministicInitiativeQueue(teamAUnits, teamBUnits, seed) {
  const all = [...(teamAUnits || []).map(u => ({ roster_id: u.id, team: 'team_a', speed: Number(u?.combat_stats?.speed || 10) })), ...(teamBUnits || []).map(u => ({ roster_id: u.id, team: 'team_b', speed: Number(u?.combat_stats?.speed || 10) }))];
  all.sort((a, b) => { if (b.speed !== a.speed) return b.speed - a.speed; return a.roster_id < b.roster_id ? -1 : 1; });
  return all;
}

// ── Handler ──
const AI_TEMPLATES = {
  training_easy: { creature_template: 'training_dummy', chassis_family: 'golems', alignment: 'guardian', element: 'stone', combat_stats: { hp: 80, max_hp: 80, guard: 8, power: 6, speed: 5, focus: 5, will: 5 }, moveset: [{ move_id: 'basic_strike', move_name: 'Pummel', move_type: 'strike', taxonomy: 'smash', element: 'stone', power: 15, accuracy: 90, cooldown: 0 }, { move_id: 'basic_guard', move_name: 'Brace', move_type: 'utility', taxonomy: 'guard', element: 'neutral', power: 0, accuracy: 100, cooldown: 2 }] },
  training_medium: { creature_template: 'sparring_golem', chassis_family: 'golems', alignment: 'cipher', element: 'volt', combat_stats: { hp: 120, max_hp: 120, guard: 12, power: 10, speed: 8, focus: 8, will: 8 }, moveset: [{ move_id: 'volt_strike', move_name: 'Shock Slam', move_type: 'strike', taxonomy: 'smash', element: 'volt', power: 20, accuracy: 85, cooldown: 1 }, { move_id: 'volt_blast', move_name: 'Arc Pulse', move_type: 'skill', taxonomy: 'blast', element: 'volt', power: 25, accuracy: 80, cooldown: 2 }, { move_id: 'basic_guard', move_name: 'Iron Wall', move_type: 'utility', taxonomy: 'guard', element: 'neutral', power: 0, accuracy: 100, cooldown: 2 }] }
};

function normalizeRosterIds(input) { if (!Array.isArray(input)) return []; return input.map(v => String(v || '').trim()).filter(Boolean); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ownerKeys = buildUserOwnerKeys(user);
    const ownerA = getCanonicalOwnerKey(user);
    if (!ownerA) return Response.json({ error: 'Unable to derive owner identity' }, { status: 403 });

    const { battle_type, mode, team_a_ids, team_b_ids, pcp_bet } = await req.json();
    if (!battle_type || !mode) return Response.json({ error: 'Missing required fields' }, { status: 400 });

    const expectedSize = mode === '1v1' ? 1 : 3;
    const teamAIds = normalizeRosterIds(team_a_ids);
    if (teamAIds.length !== expectedSize) return Response.json({ error: `${mode} requires exactly ${expectedSize} unit(s) per team` }, { status: 400 });
    if (new Set(teamAIds).size !== teamAIds.length) return Response.json({ error: 'Duplicate roster units not allowed in team A' }, { status: 400 });

    const teamAUnits = [];
    for (const id of teamAIds) {
      const unit = await getOwnedRecordById(base44, 'PupilRoster', id, ownerKeys);
      if (!unit) return Response.json({ error: `Roster unit ${id} not found or not owned` }, { status: 404 });
      teamAUnits.push(unit);
    }

    const bet = Math.max(0, Number(pcp_bet || 0));
    if (bet > 0 && battle_type !== 'training_ai') return Response.json({ error: 'PvP wagers temporarily disabled' }, { status: 400 });

    let validatedBet = 0;
    if (bet > 0) {
      const currency = await getUserCurrencyRecord(base44, ownerKeys);
      if (!currency || Number(currency.pcp_balance || 0) < bet) return Response.json({ error: 'Insufficient PcP balance' }, { status: 400 });
      validatedBet = bet;
    }

    let teamBUnits = [];
    let teamBIds = [];
    let ownerB = 'system';

    if (battle_type === 'training_ai') {
      const difficulty = mode === '1v1' ? 'training_easy' : 'training_medium';
      const template = AI_TEMPLATES[difficulty];
      for (let i = 0; i < expectedSize; i++) {
        const aiUnit = await base44.asServiceRole.entities.PupilRoster.create({ companion_id: 'system', creature_template: template.creature_template, creature_name: `${template.creature_template}_${i + 1}`, chassis_family: template.chassis_family, alignment: template.alignment, element: template.element, combat_stats: { ...template.combat_stats }, moveset: template.moveset.map(m => ({ ...m, current_cooldown: 0 })), auto_battle_enabled: true, tactics_profile: 'balanced', is_temporary_ai: true });
        teamBUnits.push(aiUnit);
        teamBIds.push(aiUnit.id);
      }
    } else {
      const normalizedTeamBIds = normalizeRosterIds(team_b_ids);
      if (normalizedTeamBIds.length !== expectedSize) return Response.json({ error: `${mode} requires exactly ${expectedSize} unit(s) for team B` }, { status: 400 });
      if (new Set(normalizedTeamBIds).size !== normalizedTeamBIds.length) return Response.json({ error: 'Duplicate roster units not allowed in team B' }, { status: 400 });
      if (normalizedTeamBIds.some(id => teamAIds.includes(id))) return Response.json({ error: 'A unit cannot be on both teams' }, { status: 400 });

      for (const id of normalizedTeamBIds) {
        const rows = await base44.asServiceRole.entities.PupilRoster.filter({ id });
        if (!rows || rows.length === 0) return Response.json({ error: `Roster unit ${id} not found` }, { status: 404 });
        teamBUnits.push(rows[0]);
      }

      const teamBOwners = new Set(teamBUnits.map(u => extractEntityOwner(u)).filter(Boolean));
      if (teamBOwners.size !== 1) return Response.json({ error: 'All team B units must be owned by the same player' }, { status: 400 });
      ownerB = Array.from(teamBOwners)[0] || 'unknown';
      teamBIds = normalizedTeamBIds;
    }

    const seed = createSecureSeed();
    const initiativeQueue = buildDeterministicInitiativeQueue(teamAUnits, teamBUnits, seed);

    const battle = await base44.entities.Battle.create({ battle_type, mode, team_a: teamAIds, team_b: teamBIds, owner_a: ownerA, owner_b: ownerB, current_round: 1, initiative_queue: initiativeQueue, pcp_bet: validatedBet, status: 'in_progress', started_at: new Date().toISOString(), seed });

    if (validatedBet > 0) {
      const currency = await getUserCurrencyRecord(base44, ownerKeys);
      if (currency) await base44.asServiceRole.entities.UserCurrency.update(currency.id, { pcp_balance: Number(currency.pcp_balance || 0) - validatedBet, pcp_wagered: Number(currency.pcp_wagered || 0) + validatedBet });
    }

    return Response.json({ battle, initiative_queue: initiativeQueue, team_a: teamAUnits, team_b: teamBUnits });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});