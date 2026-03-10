import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  getOwnedRecordById,
  isTierAtLeast,
  recomputeCompanionIdentity,
  resolveUserEntitlements
} from './_serverUtils.ts';

const EVOLUTION_PATHS: Record<string, { requiredTraits: Record<string, number>; signatureAbility: string; subtypes: Record<string, string> }> = {
  Guardian: {
    requiredTraits: { nurturing: 10, disciplined: 8 },
    signatureAbility: 'Unbreakable Vow: Absorb all damage targeted at allies for 2 turns',
    subtypes: {
      Aegis: 'Iron Wall: Reduce all incoming damage by 15%',
      Sentinel: 'Vigilant Eye: Auto-counter when an ally takes critical damage',
      Bastion: 'Living Fortress: Regenerate 5% HP per turn'
    }
  },
  Predator: {
    requiredTraits: { aggressive: 10, disciplined: 5 },
    signatureAbility: 'Apex Strike: Deal 300% power damage, ignoring all defenses',
    subtypes: {
      Blade: 'Razor Instinct: +25% critical hit chance',
      Ravager: 'Armor Break: Attacks reduce target guard by 10%',
      Hunter: 'Predator Sense: +30% damage to enemies below 40% HP'
    }
  },
  Mystic: {
    requiredTraits: { curious: 10, disciplined: 5 },
    signatureAbility: 'Arcane Tempest: Hit all enemies with their elemental weakness',
    subtypes: {
      Elementalist: 'Elemental Resonance: Elemental moves deal 20% bonus damage',
      Enchanter: 'Aura Weaver: All buffs last 1 extra turn',
      Seer: 'Foresight: 20% chance to dodge any attack'
    }
  },
  Scholar: {
    requiredTraits: { curious: 8, nurturing: 8 },
    signatureAbility: 'Grand Strategy: Reset all ally cooldowns and heal 30% HP',
    subtypes: {
      Medic: 'Triage: Healing moves are 25% more effective',
      Tactician: 'Battle Mind: Team gains +10% speed',
      Sage: 'Wisdom: Knowledge level adds to all stat calculations'
    }
  },
  Trickster: {
    requiredTraits: { chaotic: 10, curious: 5 },
    signatureAbility: 'Chaos Cascade: Apply 3 random status effects to all enemies',
    subtypes: {
      Phantom: 'Shadow Step: +30% evasion rate',
      Jester: 'Wild Card: Each turn, gain a random powerful buff',
      Saboteur: 'Disruption: 20% chance to jam enemy moves'
    }
  },
  Adaptive: {
    requiredTraits: {},
    signatureAbility: "Adaptation: Copy the strongest enemy unit's highest stat for 3 turns",
    subtypes: {
      Hybrid: 'Versatile: +10% to all stats',
      Mimic: 'Mirror: Can use the last move used against you',
      Catalyst: 'Synergy: Team composition bonuses are doubled'
    }
  }
};

function hasRequiredTraits(companion: any, requiredTraits: Record<string, number>): boolean {
  const affinity = companion?.trait_affinity || {};
  for (const [trait, minimum] of Object.entries(requiredTraits)) {
    if (Number(affinity?.[trait] || 0) < Number(minimum || 0)) {
      return false;
    }
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const companionId = String(payload?.companion_id || '').trim();
    const evolutionPath = String(payload?.evolution_path || '').trim();
    const subtype = String(payload?.subtype || '').trim();
    if (!companionId || !evolutionPath || !subtype) {
      return Response.json({ error: 'Missing companion_id, evolution_path, or subtype.' }, { status: 400 });
    }

    const pathConfig = EVOLUTION_PATHS[evolutionPath];
    if (!pathConfig) {
      return Response.json({ error: `Unsupported evolution path: ${evolutionPath}` }, { status: 400 });
    }

    const signaturePassive = pathConfig.subtypes[subtype];
    if (!signaturePassive) {
      return Response.json({ error: `Subtype ${subtype} is not valid for ${evolutionPath}.` }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, 'premium')) {
      return Response.json(
        { error: `Evolution path control requires Premium or Elite. Your current tier is ${entitlements.tier}.` },
        { status: 403 }
      );
    }

    const companion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!companion) {
      return Response.json({ error: 'Companion not found or not owned by caller.' }, { status: 404 });
    }

    if (String(companion.stage || '') !== 'teenager') {
      return Response.json({ error: 'Evolution path can only be selected at the teenager stage.' }, { status: 409 });
    }
    if (companion.evolution_path) {
      return Response.json({ error: 'Evolution path has already been selected for this companion.' }, { status: 409 });
    }
    if (!hasRequiredTraits(companion, pathConfig.requiredTraits)) {
      return Response.json({ error: 'Trait affinity requirements are not met for this evolution path.' }, { status: 403 });
    }

    const updatePayload: Record<string, any> = {
      evolution_path: evolutionPath,
      subtype,
      signature_passive: signaturePassive,
      signature_ability: pathConfig.signatureAbility
    };

    Object.assign(
      updatePayload,
      recomputeCompanionIdentity(
        { ...companion, ...updatePayload },
        { recomputedAt: new Date().toISOString() }
      )
    );

    await base44.asServiceRole.entities.Companion.update(companionId, updatePayload);
    return Response.json({
      success: true,
      companion: { ...companion, ...updatePayload }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
