import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  listOwnedRecords,
  resolveUserEntitlements
} from './_serverUtils.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    const companions = await listOwnedRecords(base44, 'Companion', ownerKeys);

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
