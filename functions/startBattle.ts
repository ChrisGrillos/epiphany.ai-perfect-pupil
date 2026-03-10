import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildDeterministicInitiativeQueue,
  buildUserOwnerKeys,
  createSecureSeed,
  extractEntityOwner,
  getCanonicalOwnerKey,
  getUserCurrencyRecord,
  getOwnedRecordById
} from './_serverUtils.ts';

/**
 * Server-authoritative battle initialization.
 * Accepts: { battle_type, mode, team_a_ids, team_b_ids?, pcp_bet? }
 * For training_ai battles, team_b is auto-generated.
 * Returns: { battle, initiative_queue }
 */

const AI_TEMPLATES = {
  training_easy: {
    creature_template: 'training_dummy',
    chassis_family: 'golems',
    alignment: 'guardian',
    element: 'stone',
    combat_stats: { hp: 80, max_hp: 80, guard: 8, power: 6, speed: 5, focus: 5, will: 5 },
    moveset: [
      { move_id: 'basic_strike', move_name: 'Pummel', move_type: 'strike', taxonomy: 'smash', element: 'stone', power: 15, accuracy: 90, cooldown: 0 },
      { move_id: 'basic_guard', move_name: 'Brace', move_type: 'utility', taxonomy: 'guard', element: 'neutral', power: 0, accuracy: 100, cooldown: 2 }
    ]
  },
  training_medium: {
    creature_template: 'sparring_golem',
    chassis_family: 'golems',
    alignment: 'cipher',
    element: 'volt',
    combat_stats: { hp: 120, max_hp: 120, guard: 12, power: 10, speed: 8, focus: 8, will: 8 },
    moveset: [
      { move_id: 'volt_strike', move_name: 'Shock Slam', move_type: 'strike', taxonomy: 'smash', element: 'volt', power: 20, accuracy: 85, cooldown: 1 },
      { move_id: 'volt_blast', move_name: 'Arc Pulse', move_type: 'skill', taxonomy: 'blast', element: 'volt', power: 25, accuracy: 80, cooldown: 2 },
      { move_id: 'basic_guard', move_name: 'Iron Wall', move_type: 'utility', taxonomy: 'guard', element: 'neutral', power: 0, accuracy: 100, cooldown: 2 }
    ]
  }
};

function normalizeRosterIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(v => String(v || '').trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const ownerA = getCanonicalOwnerKey(user);
    if (!ownerA || ownerKeys.length === 0) {
      return Response.json({ error: 'Unable to derive authenticated owner identity' }, { status: 403 });
    }

    const { battle_type, mode, team_a_ids, team_b_ids, pcp_bet } = await req.json();

    if (!battle_type || !mode) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const expectedSize = mode === '1v1' ? 1 : 3;
    const teamAIds = normalizeRosterIds(team_a_ids);
    if (teamAIds.length !== expectedSize) {
      return Response.json({ error: `${mode} requires exactly ${expectedSize} unit(s) per team` }, { status: 400 });
    }
    if (new Set(teamAIds).size !== teamAIds.length) {
      return Response.json({ error: 'Duplicate roster units are not allowed in team A' }, { status: 400 });
    }

    // Team A must always be owned by the caller.
    const teamAUnits = [];
    for (const id of teamAIds) {
      const unit = await getOwnedRecordById(base44, 'PupilRoster', id, ownerKeys);
      if (!unit) {
        return Response.json({ error: `Roster unit ${id} not found or not owned by caller` }, { status: 404 });
      }
      teamAUnits.push(unit);
    }

    const bet = Math.max(0, Number(pcp_bet || 0));
    if (bet > 0 && battle_type !== 'training_ai') {
      // Safe fallback: PvP wagers require a two-sided escrow handshake that does not exist yet.
      return Response.json(
        { error: 'PvP wagers are temporarily disabled until server escrow confirmation is implemented for both players.' },
        { status: 400 }
      );
    }

    let validatedBet = 0;
    if (bet > 0) {
      const currency = await getUserCurrencyRecord(base44, ownerKeys);
      if (!currency || Number(currency.pcp_balance || 0) < bet) {
        return Response.json({ error: 'Insufficient PcP balance for bet' }, { status: 400 });
      }
      validatedBet = bet;
    }

    let teamBUnits: any[] = [];
    let teamBIds: string[] = [];
    let ownerB = 'system';

    if (battle_type === 'training_ai') {
      const difficulty = mode === '1v1' ? 'training_easy' : 'training_medium';
      const template = AI_TEMPLATES[difficulty];
      for (let i = 0; i < expectedSize; i++) {
        const aiUnit = await base44.asServiceRole.entities.PupilRoster.create({
          companion_id: 'system',
          creature_template: template.creature_template,
          creature_name: `${template.creature_template}_${i + 1}`,
          chassis_family: template.chassis_family,
          alignment: template.alignment,
          element: template.element,
          combat_stats: { ...template.combat_stats },
          moveset: template.moveset.map(m => ({ ...m, current_cooldown: 0 })),
          auto_battle_enabled: true,
          tactics_profile: 'balanced',
          is_temporary_ai: true
        });
        teamBUnits.push(aiUnit);
        teamBIds.push(aiUnit.id);
      }
    } else {
      const normalizedTeamBIds = normalizeRosterIds(team_b_ids);
      if (normalizedTeamBIds.length !== expectedSize) {
        return Response.json({ error: `${mode} requires exactly ${expectedSize} unit(s) for team B` }, { status: 400 });
      }
      if (new Set(normalizedTeamBIds).size !== normalizedTeamBIds.length) {
        return Response.json({ error: 'Duplicate roster units are not allowed in team B' }, { status: 400 });
      }
      if (normalizedTeamBIds.some(id => teamAIds.includes(id))) {
        return Response.json({ error: 'A roster unit cannot exist on both teams' }, { status: 400 });
      }

      for (const id of normalizedTeamBIds) {
        const rows = await base44.asServiceRole.entities.PupilRoster.filter({ id });
        if (!rows || rows.length === 0) {
          return Response.json({ error: `Roster unit ${id} not found` }, { status: 404 });
        }
        teamBUnits.push(rows[0]);
      }

      const teamBOwners = new Set(
        teamBUnits
          .map(u => extractEntityOwner(u))
          .filter(Boolean)
      );

      if (teamBOwners.size !== 1) {
        return Response.json({ error: 'All team B units must be owned by the same player' }, { status: 400 });
      }

      ownerB = Array.from(teamBOwners)[0] || 'unknown';
      teamBIds = normalizedTeamBIds;
    }

    const seed = createSecureSeed();
    const initiativeQueue = buildDeterministicInitiativeQueue(teamAUnits, teamBUnits, seed);

    const battle = await base44.entities.Battle.create({
      battle_type,
      mode,
      team_a: teamAIds,
      team_b: teamBIds,
      owner_a: ownerA,
      owner_b: ownerB,
      current_round: 1,
      initiative_queue: initiativeQueue,
      pcp_bet: validatedBet,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      seed
    });

    if (validatedBet > 0) {
      const currency = await getUserCurrencyRecord(base44, ownerKeys);
      if (currency) {
        await base44.asServiceRole.entities.UserCurrency.update(currency.id, {
          pcp_balance: Number(currency.pcp_balance || 0) - validatedBet,
          pcp_wagered: Number(currency.pcp_wagered || 0) + validatedBet
        });
      }
    }

    return Response.json({
      battle,
      initiative_queue: initiativeQueue,
      team_a: teamAUnits,
      team_b: teamBUnits
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
