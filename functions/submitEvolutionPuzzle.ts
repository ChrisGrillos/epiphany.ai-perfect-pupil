import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  getOwnedRecordById,
  isTierAtLeast,
  resolveUserEntitlements
} from './_serverUtils.ts';

const DIFFICULTY_XP_MULTIPLIER: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 4
};

function normalizeDifficulty(raw: any): string {
  const difficulty = String(raw || 'easy').trim().toLowerCase();
  return DIFFICULTY_XP_MULTIPLIER[difficulty] ? difficulty : 'easy';
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
    const difficulty = normalizeDifficulty(payload?.difficulty);
    const evolutionDna = payload?.evolution_dna ?? payload?.result ?? null;

    if (!companionId) {
      return Response.json({ error: 'Missing companion_id.' }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, 'premium')) {
      return Response.json(
        { error: `Evolution puzzle is available on Premium or Elite. Your current tier is ${entitlements.tier}.` },
        { status: 403 }
      );
    }

    const companion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!companion) {
      return Response.json({ error: 'Companion not found or not owned by caller.' }, { status: 404 });
    }

    const xpGain = 50 * DIFFICULTY_XP_MULTIPLIER[difficulty];
    const bonuses = {
      personality_openness: Math.floor(Math.random() * 3) + 1,
      personality_curiosity: Math.floor(Math.random() * 3) + 1
    };
    const updatePayload = {
      ...bonuses,
      experience_points: Number(companion.experience_points || 0) + xpGain,
      evolution_dna: evolutionDna
    };

    await base44.asServiceRole.entities.Companion.update(companionId, updatePayload);

    const puzzle = await base44.asServiceRole.entities.EvolutionPuzzle.create({
      companion_id: companionId,
      puzzle_type: 'full_helix',
      completed: true,
      completion_reward: {
        ...bonuses,
        xp_gain: xpGain
      },
      difficulty
    });

    return Response.json({
      success: true,
      companion: { ...companion, ...updatePayload },
      bonuses: {
        ...bonuses,
        xp_gain: xpGain
      },
      puzzle
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
