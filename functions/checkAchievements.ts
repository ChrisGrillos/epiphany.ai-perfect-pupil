import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'] });
function uniqueStrings(values) { return Array.from(new Set(values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))); }
function buildUserOwnerKeys(user) { return uniqueStrings([user?.id, user?.user_id, user?.sub, user?.email]); }
function extractEntityOwner(entity) { if (!entity) return null; for (const key of SCHEMA_ASSUMPTIONS.ownerFields) { if (typeof entity[key] === 'string' && entity[key].trim()) return entity[key].trim(); } return null; }
function ownerMatches(owner, ownerKeys) { return owner ? ownerKeys.includes(owner) : false; }
async function getOwnedRecordById(base44, entityName, id, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.[entityName]; const usr = base44?.entities?.[entityName];
  if (svc?.filter) { try { const rows = await svc.filter({ id }); const row = Array.isArray(rows) ? rows[0] : null; if (!row) return null; const owner = extractEntityOwner(row); if (!owner) { if (usr?.filter) { const sr = await usr.filter({ id }); return Array.isArray(sr) && sr.length > 0 ? row : null; } return null; } return ownerMatches(owner, ownerKeys) ? row : null; } catch {} }
  if (usr?.filter) { try { const rows = await usr.filter({ id }); return Array.isArray(rows) && rows.length > 0 ? rows[0] : null; } catch {} }
  return null;
}

// ── Handler ──
const ACHIEVEMENT_CHECKS = [
  { key: 'first_feed', check: (comp, logs) => logs.filter(l => l.action_type === 'feed').length >= 1 },
  { key: 'fed_10', check: (comp, logs) => logs.filter(l => l.action_type === 'feed').length >= 10 },
  { key: 'fed_50', check: (comp, logs) => logs.filter(l => l.action_type === 'feed').length >= 50 },
  { key: 'first_exercise', check: (comp, logs) => logs.filter(l => l.action_type === 'exercise').length >= 1 },
  { key: 'exercise_20', check: (comp, logs) => logs.filter(l => l.action_type === 'exercise').length >= 20 },
  { key: 'first_study', check: (comp, logs) => logs.filter(l => l.action_type === 'study').length >= 1 },
  { key: 'knowledge_25', check: (comp) => (comp.knowledge_level || 0) >= 25 },
  { key: 'knowledge_50', check: (comp) => (comp.knowledge_level || 0) >= 50 },
  { key: 'knowledge_100', check: (comp) => (comp.knowledge_level || 0) >= 100 },
  { key: 'trust_25', check: (comp) => (comp.trust_level || 0) >= 25 },
  { key: 'trust_50', check: (comp) => (comp.trust_level || 0) >= 50 },
  { key: 'trust_100', check: (comp) => (comp.trust_level || 0) >= 100 },
  { key: 'bond_25', check: (comp) => (comp.bond_level || 0) >= 25 },
  { key: 'bond_50', check: (comp) => (comp.bond_level || 0) >= 50 },
  { key: 'bond_100', check: (comp) => (comp.bond_level || 0) >= 100 },
  { key: 'first_battle', check: (comp, logs) => logs.filter(l => l.action_type === 'battle').length >= 1 },
  { key: 'battles_10', check: (comp, logs) => logs.filter(l => l.action_type === 'battle').length >= 10 },
  { key: 'battles_50', check: (comp, logs) => logs.filter(l => l.action_type === 'battle').length >= 50 },
  { key: 'first_puzzle', check: (comp, logs) => logs.filter(l => l.action_type === 'puzzle').length >= 1 },
  { key: 'puzzles_10', check: (comp, logs) => logs.filter(l => l.action_type === 'puzzle').length >= 10 },
  { key: 'evolved_child', check: (comp) => ['child', 'teenager', 'adult'].includes(comp.stage) },
  { key: 'evolved_teenager', check: (comp) => ['teenager', 'adult'].includes(comp.stage) },
  { key: 'evolved_adult', check: (comp) => comp.stage === 'adult' },
  { key: 'chose_path', check: (comp) => !!comp.evolution_path },
  { key: 'all_stats_50', check: (comp) => (comp.hunger || 0) >= 50 && (comp.happiness || 0) >= 50 && (comp.fitness || 0) >= 50 && (comp.knowledge_level || 0) >= 50 },
  { key: 'total_actions_100', check: (comp) => (comp.total_care_actions || 0) >= 100 },
  { key: 'total_actions_500', check: (comp) => (comp.total_care_actions || 0) >= 500 },
  { key: 'first_memory', check: (comp, logs, extra) => (extra.memoryCount || 0) >= 1 },
  { key: 'memories_20', check: (comp, logs, extra) => (extra.memoryCount || 0) >= 20 },
  { key: 'first_rule', check: (comp, logs, extra) => (extra.ruleCount || 0) >= 1 },
];

const XP_REWARDS = {
  first_feed: 10, fed_10: 25, fed_50: 100, first_exercise: 10, exercise_20: 50,
  first_study: 10, knowledge_25: 50, knowledge_50: 100, knowledge_100: 500,
  trust_25: 25, trust_50: 75, trust_100: 250, bond_25: 30, bond_50: 80, bond_100: 300,
  first_battle: 20, battles_10: 75, battles_50: 250,
  first_puzzle: 50, puzzles_10: 200, evolved_child: 50, evolved_teenager: 100, evolved_adult: 300, chose_path: 75,
  all_stats_50: 100, total_actions_100: 150, total_actions_500: 500,
  first_memory: 15, memories_20: 75, first_rule: 20
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { companion_id } = await req.json();
    if (!companion_id) return Response.json({ error: 'Missing companion_id' }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const companion = await getOwnedRecordById(base44, 'Companion', String(companion_id), ownerKeys);
    if (!companion) return Response.json({ error: 'Companion not found or not owned by caller' }, { status: 404 });

    const [existingAchievementsScoped, logs, memories, rules, legacyAchievements] = await Promise.all([
      base44.asServiceRole.entities.Achievement.filter({ companion_id }),
      base44.asServiceRole.entities.InteractionLog.filter({ companion_id }),
      base44.asServiceRole.entities.CompanionMemory.filter({ companion_id }),
      base44.asServiceRole.entities.BehaviorRule.filter({ companion_id }),
      base44.entities.Achievement.filter({}).catch(() => [])
    ]);

    const existingKeys = new Set([
      ...(existingAchievementsScoped || []).map(a => a.achievement_key),
      ...(legacyAchievements || []).filter(a => !a.companion_id).map(a => a.achievement_key)
    ]);

    const extra = { memoryCount: (memories || []).length, ruleCount: (rules || []).length };
    const newlyUnlocked = [];
    let awardedXpTotal = 0;

    for (const achCheck of ACHIEVEMENT_CHECKS) {
      if (existingKeys.has(achCheck.key)) continue;
      let passed = false;
      try { passed = achCheck.check(companion, logs || [], extra); } catch {}
      if (passed) {
        const xpReward = XP_REWARDS[achCheck.key] || 10;
        await base44.asServiceRole.entities.Achievement.create({
          companion_id, achievement_key: achCheck.key,
          name: achCheck.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          category: achCheck.key.includes('feed') || achCheck.key.includes('exercise') ? 'care' : achCheck.key.includes('knowledge') || achCheck.key.includes('study') ? 'learning' : achCheck.key.includes('trust') || achCheck.key.includes('bond') ? 'social' : achCheck.key.includes('battle') ? 'battle' : achCheck.key.includes('puzzle') || achCheck.key.includes('evolv') || achCheck.key.includes('path') ? 'evolution' : 'special',
          xp_reward: xpReward, unlocked_at: new Date().toISOString()
        });
        newlyUnlocked.push({ key: achCheck.key, xp: xpReward });
        awardedXpTotal += xpReward;
      }
    }

    if (awardedXpTotal > 0) {
      await base44.asServiceRole.entities.Companion.update(companion_id, { experience_points: (companion.experience_points || 0) + awardedXpTotal });
    }

    return Response.json({ newly_unlocked: newlyUnlocked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});