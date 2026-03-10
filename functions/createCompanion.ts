import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  getUserCurrencyRecord,
  listOwnedRecords,
  recomputeCompanionIdentity,
  resolveUserEntitlements
} from './_serverUtils.ts';

const STARTING_STAGE_STATS: Record<string, { knowledge_level: number; personality_openness: number }> = {
  infant: { knowledge_level: 5, personality_openness: 30 },
  child: { knowledge_level: 30, personality_openness: 50 },
  teenager: { knowledge_level: 60, personality_openness: 70 }
};

function normalizeStage(raw: any): string {
  const stage = String(raw || 'child').trim().toLowerCase();
  return STARTING_STAGE_STATS[stage] ? stage : 'child';
}

function normalizeSpecies(raw: any): string {
  const species = String(raw || 'celestial').trim().toLowerCase();
  return species || 'celestial';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const name = String(payload?.name || '').trim();
    const stage = normalizeStage(payload?.stage);
    const species = normalizeSpecies(payload?.species);

    if (!name) {
      return Response.json({ error: 'Companion name is required.' }, { status: 400 });
    }
    if (name.length > 48) {
      return Response.json({ error: 'Companion name must be 48 characters or fewer.' }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    const companions = await listOwnedRecords(base44, 'Companion', ownerKeys);
    const currentCount = companions.length;

    if (currentCount >= Number(entitlements.max_pupils_allowed || 2)) {
      return Response.json(
        {
          error: `Pupil limit reached for ${entitlements.tier} tier (${entitlements.max_pupils_allowed} max). Upgrade to create more.`,
          code: 'PUPIL_LIMIT_REACHED',
          tier: entitlements.tier,
          max_pupils_allowed: entitlements.max_pupils_allowed,
          current_pupils: currentCount
        },
        { status: 403 }
      );
    }

    const stageStats = STARTING_STAGE_STATS[stage];
    const now = new Date().toISOString();
    const baseCompanion = {
      name,
      starting_stage: stage,
      stage,
      species,
      hunger: 70,
      happiness: 60,
      fitness: 50,
      knowledge_level: stageStats.knowledge_level,
      personality_openness: stageStats.personality_openness,
      personality_agreeableness: 50,
      personality_curiosity: 60,
      personality_energy: 50,
      personality_empathy: 40,
      body_form: 'round',
      body_size: 'small',
      primary_color: '#9b87f5',
      secondary_color: '#7dd3c0',
      accent_color: '#fbbf24',
      mood: 'curious',
      trust_level: 10,
      affection_level: 10,
      experience_points: 0,
      level: 1,
      special_abilities: [],
      learned_topics: [],
      trait_affinity: { aggressive: 0, nurturing: 0, curious: 0, chaotic: 0, disciplined: 0 },
      bond_level: 0,
      combat_damage_dealt: 0,
      combat_damage_blocked: 0,
      combat_healing_done: 0,
      combat_ally_saves: 0,
      combat_status_inflicted: 0,
      last_interaction: now
    };

    const identityPatch = recomputeCompanionIdentity(baseCompanion, { recomputedAt: now });
    const companion = await base44.entities.Companion.create({
      ...baseCompanion,
      ...identityPatch
    });

    const nextCount = currentCount + 1;
    const currency = await getUserCurrencyRecord(base44, ownerKeys);
    if (currency?.id) {
      await base44.asServiceRole.entities.UserCurrency.update(currency.id, {
        max_pupils_allowed: entitlements.max_pupils_allowed,
        free_pupils_count: nextCount
      });
    } else {
      await base44.entities.UserCurrency.create({
        pcp_balance: 0,
        free_pupils_count: nextCount,
        max_pupils_allowed: entitlements.max_pupils_allowed
      });
    }

    return Response.json({
      success: true,
      companion,
      tier: entitlements.tier,
      max_pupils_allowed: entitlements.max_pupils_allowed,
      current_pupils: nextCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
