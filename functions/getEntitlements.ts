import { createClientFromRequest } from '../server/runtime.js';
import {
  buildUserOwnerKeys,
  listOwnedRecords,
  resolveUserEntitlements
} from './_serverUtils.ts';

export default (async (req) => {
  try {
    const pupil = createClientFromRequest(req);
    const user = await pupil.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(pupil, ownerKeys);
    const companions = await listOwnedRecords(pupil, 'Companion', ownerKeys);

    return Response.json({
      tier: entitlements.tier,
      is_paid: entitlements.is_paid,
      max_pupils_allowed: entitlements.max_pupils_allowed,
      monthly_ai_call_limit: entitlements.monthly_ai_call_limit,
      current_pupils: companions.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
