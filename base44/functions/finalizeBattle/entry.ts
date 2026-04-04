import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'] });
function uniqueStrings(values) { return Array.from(new Set(values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))); }
function buildUserOwnerKeys(user) { return uniqueStrings([user?.id, user?.user_id, user?.sub, user?.email]); }
function ownerMatches(owner, ownerKeys) { return owner ? ownerKeys.includes(owner) : false; }
function clampStat(value, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }
function dedupeById(rows) { const out = []; const seen = new Set(); for (const row of rows || []) { const id = String(row?.id || ''); if (!id || seen.has(id)) continue; seen.add(id); out.push(row); } return out; }
async function tryFilterMany(ea, filters) { const rows = []; for (const f of filters) { try { const res = await ea.filter(f); if (Array.isArray(res)) rows.push(...res); } catch {} } return dedupeById(rows); }
async function getUserCurrencyRecord(base44, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.UserCurrency;
  const ownerFilters = ownerKeys.flatMap(k => SCHEMA_ASSUMPTIONS.ownerFields.map(f => ({ [f]: k })));
  if (svc?.filter) { const rows = await tryFilterMany(svc, ownerFilters); if (rows.length > 0) return rows[0]; }
  return null;
}
function normalizeAffinityValue(v) { const n = Number(v); return Number.isFinite(n) ? clampStat(Math.round(n), 0, 100) : 0; }
function normalizeAffinity(a) { return { aggressive: normalizeAffinityValue(a?.aggressive), nurturing: normalizeAffinityValue(a?.nurturing), curious: normalizeAffinityValue(a?.curious), chaotic: normalizeAffinityValue(a?.chaotic), disciplined: normalizeAffinityValue(a?.disciplined) }; }
function deriveCompanionIdentity(affinityInput) {
  const a = normalizeAffinity(affinityInput);
  const tS = { Fierce: a.aggressive*2+a.chaotic, Protective: a.nurturing*2+a.disciplined, Calculating: a.disciplined*2+a.curious, Playful: a.chaotic*2+a.curious, Calm: a.disciplined*2+a.nurturing, Unstable: a.chaotic*3 };
  const aS = { Berserker: a.aggressive*3, Guardian: a.nurturing*2+a.disciplined, Oracle: a.curious*2+a.disciplined, Trickster: a.chaotic*2+a.curious, Caretaker: a.nurturing*3, Duelist: a.aggressive*2+a.disciplined, Vanguard: a.disciplined*2+a.aggressive, Adaptive: 5 };
  let temperament = 'Calm', ts = -Infinity; for (const [k, s] of Object.entries(tS)) { if (s > ts) { temperament = k; ts = s; } }
  let buildArchetype = 'Adaptive', as2 = -Infinity; for (const [k, s] of Object.entries(aS)) { if (s > as2) { buildArchetype = k; as2 = s; } }
  return { trait_affinity: a, temperament, build_archetype: buildArchetype };
}
const EP_BF = { Guardian: 'Bulwark', Predator: 'Athletic', Mystic: 'Ethereal', Scholar: 'Balanced', Trickster: 'Agile', Adaptive: 'Balanced' };
const AB_BF = { Berserker: 'Athletic', Guardian: 'Bulwark', Oracle: 'Ethereal', Trickster: 'Agile', Caretaker: 'Balanced', Duelist: 'Athletic', Vanguard: 'Bulwark', Adaptive: 'Balanced' };
function recomputeCompanionIdentity(comp) {
  const c = comp || {}; const identity = deriveCompanionIdentity(c.trait_affinity);
  const bondLevel = clampStat(Number(c.bond_level || 0), 0, 100);
  let bf = null; const ep = String(c.evolution_path || '').trim(); if (ep && EP_BF[ep]) bf = EP_BF[ep];
  if (!bf && identity.build_archetype && AB_BF[identity.build_archetype]) bf = AB_BF[identity.build_archetype];
  if (!bf) bf = c.body_frame;
  return { trait_affinity: identity.trait_affinity, temperament: identity.temperament, build_archetype: identity.build_archetype, body_frame: String(bf || 'Balanced'), bond_level: bondLevel };
}

// ── Handler ──
const XP_CONFIG = { win: 50, lose: 15, draw: 25, participation: 10, ko_bonus: 10 };
const PCP_CONFIG = { training_win: 5, pvp_win_base: 20, pvp_lose: 0 };

async function cleanupTemporaryAi(base44, battle) {
  if (battle.battle_type !== 'training_ai') return;
  for (const rosterId of battle.team_b || []) { try { await base44.asServiceRole.entities.PupilRoster.delete(rosterId); } catch {} }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { battle_id } = await req.json();
    if (!battle_id) return Response.json({ error: 'Missing battle_id' }, { status: 400 });

    const battles = await base44.asServiceRole.entities.Battle.filter({ id: battle_id });
    if (!battles || battles.length === 0) return Response.json({ error: 'Battle not found' }, { status: 404 });
    const battle = battles[0];

    const ownerKeys = buildUserOwnerKeys(user);
    if (!ownerMatches(battle.owner_a, ownerKeys) && !ownerMatches(battle.owner_b, ownerKeys)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (battle.status !== 'completed') return Response.json({ error: 'Battle is not completed' }, { status: 400 });

    const existingResults = await base44.asServiceRole.entities.BattleResult.filter({ battle_id });
    if (existingResults && existingResults.length > 0) {
      const existing = existingResults[0];
      return Response.json({ result: existing, xp_awards: existing.xp_awards || {}, pcp_awards: existing.pcp_awards || {}, already_finalized: true });
    }

    const turns = await base44.asServiceRole.entities.BattleTurn.filter({ battle_id });
    const teamASummary = { total_damage_dealt: 0, total_damage_taken: 0, total_healing: 0, kos_scored: 0, kos_suffered: 0, mvp_roster_id: null };
    const teamBSummary = { total_damage_dealt: 0, total_damage_taken: 0, total_healing: 0, kos_scored: 0, kos_suffered: 0, mvp_roster_id: null };
    const damageByUnit = {};

    for (const turn of turns || []) {
      const summary = turn.actor_team === 'team_a' ? teamASummary : teamBSummary;
      const oppSummary = turn.actor_team === 'team_a' ? teamBSummary : teamASummary;
      summary.total_damage_dealt += Number(turn.damage_dealt || 0);
      oppSummary.total_damage_taken += Number(turn.damage_dealt || 0);
      summary.total_healing += Number(turn.healing_done || 0);
      if (turn.ko_triggered) { summary.kos_scored += 1; oppSummary.kos_suffered += 1; }
      if (!damageByUnit[turn.actor_roster_id]) damageByUnit[turn.actor_roster_id] = { damage: 0, team: turn.actor_team };
      damageByUnit[turn.actor_roster_id].damage += Number(turn.damage_dealt || 0);
    }

    let mvpA = null, mvpADmg = -1, mvpB = null, mvpBDmg = -1;
    for (const [id, data] of Object.entries(damageByUnit)) {
      if (data.team === 'team_a' && data.damage > mvpADmg) { mvpA = id; mvpADmg = data.damage; }
      if (data.team === 'team_b' && data.damage > mvpBDmg) { mvpB = id; mvpBDmg = data.damage; }
    }
    teamASummary.mvp_roster_id = mvpA; teamBSummary.mvp_roster_id = mvpB;

    const xpAwards = {};
    const allIds = [...(battle.team_a || []), ...(battle.team_b || [])].map(id => String(id));
    for (const rosterId of allIds) {
      const isTeamA = (battle.team_a || []).map(id => String(id)).includes(rosterId);
      const team = isTeamA ? 'team_a' : 'team_b';
      let xp = XP_CONFIG.participation;
      if (battle.winner === 'draw') xp += XP_CONFIG.draw;
      else if (battle.winner === team) xp += XP_CONFIG.win;
      else xp += XP_CONFIG.lose;
      const unitKOs = (turns || []).filter(t => t.actor_roster_id === rosterId && t.ko_triggered).length;
      xp += unitKOs * XP_CONFIG.ko_bonus;
      xpAwards[rosterId] = xp;
    }

    const pcpAwards = {};
    const ownerA = String(battle.owner_a || '');
    const ownerB = String(battle.owner_b || '');
    if (battle.battle_type === 'training_ai') {
      if (ownerA && battle.winner === 'team_a') pcpAwards[ownerA] = PCP_CONFIG.training_win;
    } else {
      const escrowA = Number(battle.pcp_escrow_a || 0); const escrowB = Number(battle.pcp_escrow_b || 0); const escrowPool = escrowA + escrowB;
      if (battle.winner === 'team_a') { if (ownerA) pcpAwards[ownerA] = PCP_CONFIG.pvp_win_base + escrowPool; if (ownerB) pcpAwards[ownerB] = PCP_CONFIG.pvp_lose; }
      else if (battle.winner === 'team_b') { if (ownerA) pcpAwards[ownerA] = PCP_CONFIG.pvp_lose; if (ownerB) pcpAwards[ownerB] = PCP_CONFIG.pvp_win_base + escrowPool; }
      else if (battle.winner === 'draw') { if (ownerA) pcpAwards[ownerA] = escrowA; if (ownerB) pcpAwards[ownerB] = escrowB; }
    }

    const startTime = battle.started_at ? new Date(battle.started_at) : new Date();
    const endTime = battle.completed_at ? new Date(battle.completed_at) : new Date();
    const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

    const result = await base44.asServiceRole.entities.BattleResult.create({ battle_id, winner: battle.winner, total_rounds: battle.current_round, duration_seconds: durationSeconds, team_a_summary: teamASummary, team_b_summary: teamBSummary, xp_awards: xpAwards, pcp_awards: pcpAwards, rewards_distributed: true });

    for (const [rosterId, xp] of Object.entries(xpAwards)) {
      if ((battle.team_b || []).map(id => String(id)).includes(rosterId) && ownerB === 'system') continue;
      const units = await base44.asServiceRole.entities.PupilRoster.filter({ id: rosterId });
      if (!units || units.length === 0) continue;
      const unit = units[0];
      const isTeamA = (battle.team_a || []).map(id => String(id)).includes(rosterId);
      const team = isTeamA ? 'team_a' : 'team_b';
      const won = battle.winner === team; const drew = battle.winner === 'draw';
      await base44.asServiceRole.entities.PupilRoster.update(rosterId, { total_xp: Number(unit.total_xp || 0) + Number(xp || 0), total_battles: Number(unit.total_battles || 0) + 1, wins: Number(unit.wins || 0) + (won ? 1 : 0), losses: Number(unit.losses || 0) + (!won && !drew ? 1 : 0), draws: Number(unit.draws || 0) + (drew ? 1 : 0), combat_stats: { ...unit.combat_stats, hp: unit.combat_stats?.max_hp || unit.combat_stats?.hp || 0 }, active_statuses: [], is_fainted: false });
    }

    for (const [ownerKey, pcp] of Object.entries(pcpAwards)) {
      if (!ownerKey || ownerKey === 'system' || Number(pcp || 0) <= 0) continue;
      const currency = await getUserCurrencyRecord(base44, [ownerKey]);
      if (!currency) continue;
      await base44.asServiceRole.entities.UserCurrency.update(currency.id, { pcp_balance: Number(currency.pcp_balance || 0) + Number(pcp || 0), pcp_earned: Number(currency.pcp_earned || 0) + Number(pcp || 0), pcp_won: Number(currency.pcp_won || 0) + Number(pcp || 0) });
    }

    for (const rosterId of battle.team_a || []) {
      const units = await base44.asServiceRole.entities.PupilRoster.filter({ id: rosterId });
      if (!units || units.length === 0 || !units[0].companion_id || units[0].companion_id === 'system') continue;
      const companionId = units[0].companion_id;
      const unitTurns = (turns || []).filter(t => t.actor_roster_id === rosterId);
      const dmgDealt = unitTurns.reduce((sum, t) => sum + Number(t.damage_dealt || 0), 0);
      const healDone = unitTurns.reduce((sum, t) => sum + Number(t.healing_done || 0), 0);
      const statusCount = unitTurns.reduce((sum, t) => sum + Number(t.statuses_applied?.length || 0), 0);

      await base44.asServiceRole.entities.InteractionLog.create({ companion_id: companionId, action_type: 'battle', details: { battle_id, winner: battle.winner, xp: xpAwards[String(rosterId)] || 0 }, xp_awarded: xpAwards[String(rosterId)] || 0, pcp_awarded: pcpAwards[String(ownerA)] || 0, source: 'battle' });

      const companions = await base44.asServiceRole.entities.Companion.filter({ id: companionId });
      if (!companions || companions.length === 0) continue;
      const comp = companions[0];
      const baseAffinity = comp.trait_affinity || {};
      const nextAffinity = { ...baseAffinity, aggressive: Number(baseAffinity.aggressive || 0) + 2, disciplined: Number(baseAffinity.disciplined || 0) + 1 };
      const companionChanges = { trait_affinity: nextAffinity, bond_level: Math.min(100, Number(comp.bond_level || 0) + 3), combat_damage_dealt: Number(comp.combat_damage_dealt || 0) + dmgDealt, combat_healing_done: Number(comp.combat_healing_done || 0) + healDone, combat_status_inflicted: Number(comp.combat_status_inflicted || 0) + statusCount };
      Object.assign(companionChanges, recomputeCompanionIdentity({ ...comp, ...companionChanges }));
      await base44.asServiceRole.entities.Companion.update(companionId, companionChanges);
    }

    await cleanupTemporaryAi(base44, battle);
    return Response.json({ result, xp_awards: xpAwards, pcp_awards: pcpAwards });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});