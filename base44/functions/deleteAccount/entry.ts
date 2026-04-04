import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ownerEmail = user.email;

    // Delete all user-owned entities in parallel
    const companions = await base44.asServiceRole.entities.Companion.filter({ created_by: ownerEmail });
    const companionIds = companions.map(c => c.id);

    // Gather child entities from all companions
    const childDeletes = [];
    for (const cid of companionIds) {
      childDeletes.push(
        base44.asServiceRole.entities.InteractionLog.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.InteractionLog.delete(i.id))),
        base44.asServiceRole.entities.ChatMessage.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.ChatMessage.delete(i.id))),
        base44.asServiceRole.entities.ChatSession.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.ChatSession.delete(i.id))),
        base44.asServiceRole.entities.CompanionMemory.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.CompanionMemory.delete(i.id))),
        base44.asServiceRole.entities.BehaviorRule.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.BehaviorRule.delete(i.id))),
        base44.asServiceRole.entities.AlgorithmState.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.AlgorithmState.delete(i.id))),
        base44.asServiceRole.entities.EvolutionPuzzle.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.EvolutionPuzzle.delete(i.id))),
        base44.asServiceRole.entities.EvolutionAttempt.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.EvolutionAttempt.delete(i.id))),
        base44.asServiceRole.entities.PupilRoster.filter({ companion_id: String(cid) }).then(items => items.map(i => base44.asServiceRole.entities.PupilRoster.delete(i.id)))
      );
    }

    // Wait for child entity fetches then flatten and execute deletes
    const nestedDeleteOps = await Promise.all(childDeletes);
    await Promise.all(nestedDeleteOps.flat());

    // Delete companions themselves
    await Promise.all(companionIds.map(id => base44.asServiceRole.entities.Companion.delete(id)));

    // Delete user-level entities
    const [subs, currencies, inventories, achievements, configs, battles, results, turns] = await Promise.all([
      base44.asServiceRole.entities.Subscription.filter({ created_by: ownerEmail }),
      base44.asServiceRole.entities.UserCurrency.filter({ created_by: ownerEmail }),
      base44.asServiceRole.entities.Inventory.filter({ created_by: ownerEmail }),
      base44.asServiceRole.entities.Achievement.filter({ created_by: ownerEmail }),
      base44.asServiceRole.entities.AIProviderConfig.filter({ created_by: ownerEmail }),
      base44.asServiceRole.entities.Battle.filter({ owner_a: ownerEmail }),
      base44.asServiceRole.entities.BattleResult.filter({ created_by: ownerEmail }),
      base44.asServiceRole.entities.BattleTurn.filter({ created_by: ownerEmail })
    ]);

    await Promise.all([
      ...subs.map(r => base44.asServiceRole.entities.Subscription.delete(r.id)),
      ...currencies.map(r => base44.asServiceRole.entities.UserCurrency.delete(r.id)),
      ...inventories.map(r => base44.asServiceRole.entities.Inventory.delete(r.id)),
      ...achievements.map(r => base44.asServiceRole.entities.Achievement.delete(r.id)),
      ...configs.map(r => base44.asServiceRole.entities.AIProviderConfig.delete(r.id)),
      ...battles.map(r => base44.asServiceRole.entities.Battle.delete(r.id)),
      ...results.map(r => base44.asServiceRole.entities.BattleResult.delete(r.id)),
      ...turns.map(r => base44.asServiceRole.entities.BattleTurn.delete(r.id))
    ]);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});