import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  getMaxPupilsForTier,
  getUserCurrencyRecord,
  listOwnedRecords,
  normalizeTier,
  resolveUserEntitlements
} from './_serverUtils.ts';

const MONTHLY_PRICES = {
  free: 0,
  basic: 0.99,
  premium: 4.99,
  elite: 9.99
};

const TIER_FEATURES = {
  free: ['basic_view', 'limited_chat'],
  basic: ['full_care', 'unlimited_chat', 'store_access', 'brain_export', 'achievements'],
  premium: ['full_care', 'unlimited_chat', 'store_access', 'brain_export', 'achievements', 'evolution_control', 'customization'],
  elite: ['full_care', 'unlimited_chat', 'store_access', 'brain_export', 'achievements', 'evolution_control', 'customization', 'puzzles', 'advanced_personalization']
};

function sortByRecency(rows) {
  return [...(rows || [])].sort((a, b) => {
    const aTs = new Date(a?.updated_date || a?.created_date || 0).getTime();
    const bTs = new Date(b?.updated_date || b?.created_date || 0).getTime();
    return bTs - aTs;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const requestedTier = normalizeTier(payload?.tier);
    if (!MONTHLY_PRICES.hasOwnProperty(requestedTier)) {
      return Response.json({ error: 'Invalid subscription tier.' }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const companions = await listOwnedRecords(base44, 'Companion', ownerKeys);
    const companionCount = companions.length;
    const maxForRequestedTier = getMaxPupilsForTier(requestedTier);

    if (companionCount > maxForRequestedTier) {
      return Response.json(
        {
          error: `Cannot switch to ${requestedTier}: you currently have ${companionCount} pupils, but ${requestedTier} allows only ${maxForRequestedTier}.`,
          code: 'DOWNGRADE_BLOCKED_BY_PUPIL_COUNT',
          current_pupils: companionCount,
          max_pupils_allowed: maxForRequestedTier
        },
        { status: 409 }
      );
    }

    const subscriptionRows = sortByRecency(await listOwnedRecords(base44, 'Subscription', ownerKeys));
    const primary = subscriptionRows[0] || null;
    const subscriptionPayload = {
      tier: requestedTier,
      monthly_price: MONTHLY_PRICES[requestedTier],
      is_active: true,
      features: TIER_FEATURES[requestedTier]
    };

    let subscription = null;
    if (primary?.id) {
      subscription = await base44.asServiceRole.entities.Subscription.update(primary.id, subscriptionPayload);
      for (const row of subscriptionRows.slice(1)) {
        if (!row?.id) continue;
        await base44.asServiceRole.entities.Subscription.update(row.id, { is_active: false });
      }
    } else {
      subscription = await base44.entities.Subscription.create(subscriptionPayload);
    }

    const currency = await getUserCurrencyRecord(base44, ownerKeys);
    if (currency?.id) {
      await base44.asServiceRole.entities.UserCurrency.update(currency.id, {
        max_pupils_allowed: maxForRequestedTier
      });
    } else {
      await base44.entities.UserCurrency.create({
        pcp_balance: 0,
        free_pupils_count: companionCount,
        max_pupils_allowed: maxForRequestedTier
      });
    }

    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    return Response.json({
      success: true,
      subscription,
      tier: entitlements.tier,
      max_pupils_allowed: entitlements.max_pupils_allowed,
      current_pupils: companionCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});