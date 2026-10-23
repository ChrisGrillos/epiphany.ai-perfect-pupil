import { createClientFromRequest } from '../server/runtime.js';
import {
  buildUserOwnerKeys,
  ensureCompanionCombatRosterUnit,
  getOwnedRecordById,
  hasTeenageCombatAccess,
  listOwnedRecords
} from './_serverUtils.ts';

/**
 * Ensures an eligible companion has a player-owned battle roster unit.
 * Accepts: { companion_id? }
 * Returns: { success, combat_unlocked, combat_roster_unit, companion }
 */

export default (async (req) => {
  try {
    const pupil = createClientFromRequest(req);
    const user = await pupil.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const companionId = String(payload?.companion_id || '').trim();
    const ownerKeys = buildUserOwnerKeys(user);

    let companion = null;
    if (companionId) {
      companion = await getOwnedRecordById(pupil, 'Companion', companionId, ownerKeys);
    } else {
      const companions = await listOwnedRecords(pupil, 'Companion', ownerKeys);
      companion = companions[0] || null;
    }

    if (!companion) {
      return Response.json({ error: 'Companion not found or not owned by caller.' }, { status: 404 });
    }

    if (!hasTeenageCombatAccess(companion.stage)) {
      return Response.json({
        success: true,
        combat_unlocked: false,
        reason: 'Combat unlocks when your pupil reaches the teenager stage.',
        companion,
        combat_roster_unit: null
      });
    }

    const combatRosterUnit = await ensureCompanionCombatRosterUnit(pupil, companion, {
      refreshExisting: false
    });

    return Response.json({
      success: true,
      combat_unlocked: true,
      companion,
      combat_roster_unit: combatRosterUnit
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
