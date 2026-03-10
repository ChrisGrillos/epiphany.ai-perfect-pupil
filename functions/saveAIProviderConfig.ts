import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  isTierAtLeast,
  listOwnedRecords,
  resolveUserEntitlements
} from './_serverUtils.ts';

const PROVIDER_RULES: Record<string, { minTier: string; requiresKey: boolean; models?: string[] }> = {
  default: { minTier: 'free', requiresKey: false },
  openai: { minTier: 'premium', requiresKey: true, models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  anthropic: { minTier: 'premium', requiresKey: true, models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  grok: { minTier: 'elite', requiresKey: true, models: ['grok-1', 'grok-2'] },
  custom: { minTier: 'elite', requiresKey: true }
};

function sortByRecency(rows: any[]): any[] {
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
    const providerName = String(payload?.provider_name || 'default').trim().toLowerCase();
    const providerRules = PROVIDER_RULES[providerName];
    if (!providerRules) {
      return Response.json({ error: `Unsupported provider: ${providerName}` }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, providerRules.minTier)) {
      return Response.json(
        { error: `${providerName} requires the ${providerRules.minTier} tier. Your current tier is ${entitlements.tier}.` },
        { status: 403 }
      );
    }

    const rows = sortByRecency(await listOwnedRecords(base44, 'AIProviderConfig', ownerKeys));
    const primary = rows[0] || null;
    const providedApiKey = String(payload?.api_key || '').trim();
    const storedApiKey = String(primary?.api_key || '').trim();
    const apiKey = providedApiKey || storedApiKey || null;

    if (providerRules.requiresKey && !apiKey) {
      return Response.json({ error: `${providerName} requires an API key.` }, { status: 400 });
    }

    const requestedModel = payload?.model_name ? String(payload.model_name).trim() : '';
    if (providerRules.models && requestedModel && !providerRules.models.includes(requestedModel)) {
      return Response.json({ error: `Model ${requestedModel} is not supported for ${providerName}.` }, { status: 400 });
    }

    const fallbackToDefault = payload?.fallback_to_default !== false;
    const apiEndpoint = providerName === 'custom' ? String(payload?.api_endpoint || '').trim() : null;
    if (providerName === 'custom' && !apiEndpoint) {
      return Response.json({ error: 'Custom provider requires api_endpoint.' }, { status: 400 });
    }

    const upsertPayload: Record<string, any> = {
      provider_name: providerName,
      api_endpoint: apiEndpoint,
      model_name: requestedModel || null,
      fallback_to_default: fallbackToDefault,
      call_limit: entitlements.monthly_ai_call_limit,
      monthly_api_calls: Number(primary?.monthly_api_calls || 0),
      is_active: true,
      last_used: new Date().toISOString()
    };
    if (apiKey) {
      upsertPayload.api_key = apiKey;
    }

    let config: any = null;
    if (primary?.id) {
      config = await base44.asServiceRole.entities.AIProviderConfig.update(primary.id, upsertPayload);
      for (const row of rows.slice(1)) {
        if (!row?.id) continue;
        await base44.asServiceRole.entities.AIProviderConfig.update(row.id, { is_active: false });
      }
    } else {
      config = await base44.entities.AIProviderConfig.create(upsertPayload);
    }

    return Response.json({
      success: true,
      config: {
        ...config,
        api_key: config?.api_key ? '********' : null
      },
      tier: entitlements.tier,
      monthly_ai_call_limit: entitlements.monthly_ai_call_limit
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
