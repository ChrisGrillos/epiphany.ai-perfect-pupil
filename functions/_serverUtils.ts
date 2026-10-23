type AnyRecord = Record<string, any>;

export const SCHEMA_ASSUMPTIONS = Object.freeze({
  ownerFields: ['created_by', 'owner_id', 'user_id'],
  paidTiers: ['basic', 'premium', 'elite', 'plus', 'pro', 'family', 'enterprise', 'team'],
  maxEncryptedImportBytes: 2 * 1024 * 1024,
  traitAffinityMin: 0,
  traitAffinityMax: 100,
  identityVersion: 2
});

const TIER_CONFIG: Record<string, { rank: number; maxPupils: number; monthlyAiCalls: number; isPaid: boolean }> = Object.freeze({
  free: { rank: 0, maxPupils: 2, monthlyAiCalls: 100, isPaid: false },
  basic: { rank: 1, maxPupils: 5, monthlyAiCalls: 500, isPaid: true },
  premium: { rank: 2, maxPupils: 10, monthlyAiCalls: 2000, isPaid: true },
  elite: { rank: 3, maxPupils: 20, monthlyAiCalls: 10000, isPaid: true }
});

const TIER_ALIASES: Record<string, string> = Object.freeze({
  plus: 'basic',
  pro: 'premium',
  family: 'premium',
  team: 'elite',
  enterprise: 'elite'
});

const enc = new TextEncoder();
const dec = new TextDecoder();

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
    )
  );
}

export function buildUserOwnerKeys(user: AnyRecord | null | undefined): string[] {
  return uniqueStrings([
    user?.id,
    user?.user_id,
    user?.sub,
    user?.email
  ]);
}

export function getCanonicalOwnerKey(user: AnyRecord | null | undefined): string {
  const keys = buildUserOwnerKeys(user);
  return keys[0] || '';
}

export function extractEntityOwner(entity: AnyRecord | null | undefined): string | null {
  if (!entity) return null;
  for (const key of SCHEMA_ASSUMPTIONS.ownerFields) {
    if (typeof entity[key] === 'string' && entity[key].trim()) {
      return entity[key].trim();
    }
  }
  return null;
}

export function ownerMatches(owner: string | null | undefined, ownerKeys: string[]): boolean {
  if (!owner) return false;
  return ownerKeys.includes(owner);
}

function dedupeById(rows: AnyRecord[]): AnyRecord[] {
  const out: AnyRecord[] = [];
  const seen = new Set<string>();
  for (const row of rows || []) {
    const id = String(row?.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

async function tryFilterMany(entityAccessor: AnyRecord, filters: AnyRecord[]): Promise<AnyRecord[]> {
  const rows: AnyRecord[] = [];
  for (const f of filters) {
    try {
      const res = await entityAccessor.filter(f);
      if (Array.isArray(res) && res.length > 0) {
        rows.push(...res);
      }
    } catch {
      // Ignore unknown-filter-field and permission errors; we try multiple selectors.
    }
  }
  return dedupeById(rows);
}

export async function getOwnedRecordById(
  pupil: AnyRecord,
  entityName: string,
  id: string,
  ownerKeys: string[]
): Promise<AnyRecord | null> {
  const serviceAccessor = pupil?.service?.entities?.[entityName];
  const userAccessor = pupil?.entities?.[entityName];

  if (serviceAccessor?.filter) {
    try {
      const rows = await serviceAccessor.filter({ id });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      const owner = extractEntityOwner(row);
      if (!owner) {
        if (userAccessor?.filter) {
          const scopedRows = await userAccessor.filter({ id });
          return Array.isArray(scopedRows) && scopedRows.length > 0 ? row : null;
        }
        return null;
      }
      return ownerMatches(owner, ownerKeys) ? row : null;
    } catch {
      // Fall through to user-scoped access
    }
  }

  if (userAccessor?.filter) {
    try {
      const rows = await userAccessor.filter({ id });
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function listOwnedRecords(
  pupil: AnyRecord,
  entityName: string,
  ownerKeys: string[]
): Promise<AnyRecord[]> {
  const serviceAccessor = pupil?.service?.entities?.[entityName];
  const userAccessor = pupil?.entities?.[entityName];
  const ownerFilters = ownerKeys.flatMap(ownerKey =>
    SCHEMA_ASSUMPTIONS.ownerFields.map(field => ({ [field]: ownerKey }))
  );

  if (serviceAccessor?.filter && ownerFilters.length > 0) {
    const rows = await tryFilterMany(serviceAccessor, ownerFilters);
    if (rows.length > 0) return rows;
  }

  if (userAccessor?.list) {
    try {
      const rows = await userAccessor.list();
      return Array.isArray(rows) ? rows : [];
    } catch {
      // Fall back to filter if list is unavailable.
    }
  }

  if (userAccessor?.filter) {
    try {
      const rows = await userAccessor.filter({});
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  return [];
}

export async function getUserCurrencyRecord(pupil: AnyRecord, ownerKeys: string[]): Promise<AnyRecord | null> {
  const serviceAccessor = pupil?.service?.entities?.UserCurrency;
  const userAccessor = pupil?.entities?.UserCurrency;
  const ownerFilters = ownerKeys.flatMap(ownerKey =>
    SCHEMA_ASSUMPTIONS.ownerFields.map(field => ({ [field]: ownerKey }))
  );

  if (serviceAccessor?.filter) {
    const rows = await tryFilterMany(serviceAccessor, ownerFilters);
    if (rows.length > 0) return rows[0];
  }

  if (userAccessor?.filter) {
    try {
      const rows = await userAccessor.filter({});
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function normalizeTier(rawTier: any): string {
  const normalized = String(rawTier || 'free').trim().toLowerCase();
  const canonical = TIER_ALIASES[normalized] || normalized;
  return TIER_CONFIG[canonical] ? canonical : 'free';
}

function tierRank(rawTier: any): number {
  const tier = normalizeTier(rawTier);
  return TIER_CONFIG[tier]?.rank ?? 0;
}

export function isTierAtLeast(currentTier: any, requiredTier: any): boolean {
  return tierRank(currentTier) >= tierRank(requiredTier);
}

export function getMaxPupilsForTier(rawTier: any): number {
  return TIER_CONFIG[normalizeTier(rawTier)]?.maxPupils ?? TIER_CONFIG.free.maxPupils;
}

export function getMonthlyAiCallLimitForTier(rawTier: any): number {
  return TIER_CONFIG[normalizeTier(rawTier)]?.monthlyAiCalls ?? TIER_CONFIG.free.monthlyAiCalls;
}

export function isPaidTier(tier: any): boolean {
  return TIER_CONFIG[normalizeTier(tier)]?.isPaid || SCHEMA_ASSUMPTIONS.paidTiers.includes(String(tier || '').toLowerCase());
}

async function listSubscriptionRows(pupil: AnyRecord, ownerKeys: string[]): Promise<AnyRecord[]> {
  const serviceAccessor = pupil?.service?.entities?.Subscription;
  const userAccessor = pupil?.entities?.Subscription;
  const ownerFilters = ownerKeys.flatMap(ownerKey =>
    SCHEMA_ASSUMPTIONS.ownerFields.map(field => ({ [field]: ownerKey }))
  );

  let rows: AnyRecord[] = [];

  if (serviceAccessor?.filter) {
    rows = await tryFilterMany(serviceAccessor, ownerFilters);
  }

  if (rows.length === 0 && userAccessor?.filter) {
    try {
      const scoped = await userAccessor.filter({});
      if (Array.isArray(scoped)) rows = scoped;
    } catch {
      rows = [];
    }
  }

  return rows;
}

export async function resolveUserEntitlements(pupil: AnyRecord, ownerKeys: string[]): Promise<AnyRecord> {
  const rows = await listSubscriptionRows(pupil, ownerKeys);
  const ranked = [...rows].sort((a, b) => {
    const aActive = a?.is_active === false ? 0 : 1;
    const bActive = b?.is_active === false ? 0 : 1;
    if (bActive !== aActive) return bActive - aActive;

    const rankDelta = tierRank(b?.tier) - tierRank(a?.tier);
    if (rankDelta !== 0) return rankDelta;
    const aTs = new Date(a?.updated_date || a?.created_date || 0).getTime();
    const bTs = new Date(b?.updated_date || b?.created_date || 0).getTime();
    return bTs - aTs;
  });

  const subscription = ranked.find((row: AnyRecord) => row?.is_active !== false) || ranked[0] || null;
  const tier = normalizeTier(subscription?.tier || 'free');
  const config = TIER_CONFIG[tier] || TIER_CONFIG.free;

  return {
    tier,
    is_paid: config.isPaid,
    max_pupils_allowed: config.maxPupils,
    monthly_ai_call_limit: config.monthlyAiCalls,
    subscription
  };
}

export async function getUserSubscriptionTier(pupil: AnyRecord, ownerKeys: string[]): Promise<string> {
  const entitlements = await resolveUserEntitlements(pupil, ownerKeys);
  return entitlements.tier;
}

export function hashString(value: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSecureSeed(): number {
  const raw = crypto.getRandomValues(new Uint32Array(1))[0];
  return raw >>> 0;
}

export function nextSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

export function seededFloat01(seed: number): number {
  return (seed >>> 0) / 4294967295;
}

export function buildDeterministicInitiativeQueue(
  teamAUnits: AnyRecord[],
  teamBUnits: AnyRecord[],
  seed: number
): AnyRecord[] {
  const allUnits = [
    ...teamAUnits.map(u => ({
      roster_id: u.id || u._id,
      team: 'team_a',
      speed: u.combat_stats?.speed || 10,
      name: u.creature_name || u.creature_template
    })),
    ...teamBUnits.map(u => ({
      roster_id: u.id || u._id,
      team: 'team_b',
      speed: u.combat_stats?.speed || 10,
      name: u.creature_name || u.creature_template
    }))
  ];

  allUnits.sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    const ah = hashString(`${seed}:${a.roster_id}`);
    const bh = hashString(`${seed}:${b.roster_id}`);
    if (ah !== bh) return ah - bh;
    return String(a.roster_id).localeCompare(String(b.roster_id));
  });

  return allUnits;
}

const EVOLUTION_PATH_BODY_FRAMES: Record<string, string> = Object.freeze({
  Guardian: 'Bulwark',
  Predator: 'Athletic',
  Mystic: 'Ethereal',
  Scholar: 'Balanced',
  Trickster: 'Agile',
  Adaptive: 'Balanced'
});

const SUBTYPE_BODY_FRAMES: Record<string, string> = Object.freeze({
  aegis: 'Bulwark',
  sentinel: 'Bulwark',
  bastion: 'Bulwark',
  blade: 'Athletic',
  ravager: 'Athletic',
  hunter: 'Athletic',
  elementalist: 'Ethereal',
  enchanter: 'Ethereal',
  seer: 'Ethereal',
  medic: 'Balanced',
  tactician: 'Balanced',
  sage: 'Balanced',
  phantom: 'Agile',
  jester: 'Agile',
  saboteur: 'Agile',
  hybrid: 'Balanced',
  mimic: 'Balanced',
  catalyst: 'Balanced'
});

const ARCHETYPE_BODY_FRAMES: Record<string, string> = Object.freeze({
  Berserker: 'Athletic',
  Guardian: 'Bulwark',
  Oracle: 'Ethereal',
  Trickster: 'Agile',
  Caretaker: 'Balanced',
  Duelist: 'Athletic',
  Vanguard: 'Bulwark',
  Adaptive: 'Balanced'
});

function normalizeAffinityValue(value: any): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return clampStat(
    Math.round(numeric),
    SCHEMA_ASSUMPTIONS.traitAffinityMin,
    SCHEMA_ASSUMPTIONS.traitAffinityMax
  );
}

function normalizeAffinity(affinity: AnyRecord | null | undefined): AnyRecord {
  return {
    aggressive: normalizeAffinityValue(affinity?.aggressive),
    nurturing: normalizeAffinityValue(affinity?.nurturing),
    curious: normalizeAffinityValue(affinity?.curious),
    chaotic: normalizeAffinityValue(affinity?.chaotic),
    disciplined: normalizeAffinityValue(affinity?.disciplined)
  };
}

export function deriveCompanionIdentity(affinityInput: AnyRecord | null | undefined): AnyRecord {
  const affinity = normalizeAffinity(affinityInput);
  const { aggressive, nurturing, curious, chaotic, disciplined } = affinity;

  const temperamentScores: Record<string, number> = {
    Fierce: aggressive * 2 + chaotic,
    Protective: nurturing * 2 + disciplined,
    Calculating: disciplined * 2 + curious,
    Playful: chaotic * 2 + curious,
    Calm: disciplined * 2 + nurturing,
    Unstable: chaotic * 3
  };

  const archetypeScores: Record<string, number> = {
    Berserker: aggressive * 3,
    Guardian: nurturing * 2 + disciplined,
    Oracle: curious * 2 + disciplined,
    Trickster: chaotic * 2 + curious,
    Caretaker: nurturing * 3,
    Duelist: aggressive * 2 + disciplined,
    Vanguard: disciplined * 2 + aggressive,
    Adaptive: 5
  };

  let temperament = 'Calm';
  let temperamentScore = Number.NEGATIVE_INFINITY;
  for (const [key, score] of Object.entries(temperamentScores)) {
    if (score > temperamentScore) {
      temperament = key;
      temperamentScore = score;
    }
  }

  let buildArchetype = 'Adaptive';
  let archetypeScore = Number.NEGATIVE_INFINITY;
  for (const [key, score] of Object.entries(archetypeScores)) {
    if (score > archetypeScore) {
      buildArchetype = key;
      archetypeScore = score;
    }
  }

  return {
    trait_affinity: affinity,
    temperament,
    build_archetype: buildArchetype
  };
}

function deriveBodyFrame(companion: AnyRecord, buildArchetype: string, affinity: AnyRecord): string | null {
  const evolutionPath = String(companion?.evolution_path || '').trim();
  if (evolutionPath && EVOLUTION_PATH_BODY_FRAMES[evolutionPath]) {
    return EVOLUTION_PATH_BODY_FRAMES[evolutionPath];
  }

  const subtype = String(companion?.subtype || '').trim().toLowerCase();
  if (subtype && SUBTYPE_BODY_FRAMES[subtype]) {
    return SUBTYPE_BODY_FRAMES[subtype];
  }

  if (buildArchetype && ARCHETYPE_BODY_FRAMES[buildArchetype]) {
    return ARCHETYPE_BODY_FRAMES[buildArchetype];
  }

  const powerAxis = Number(affinity.aggressive || 0) + Number(affinity.disciplined || 0);
  const agilityAxis = Number(affinity.chaotic || 0) + Number(affinity.curious || 0);
  const supportAxis = Number(affinity.nurturing || 0) + Number(affinity.disciplined || 0);

  if (powerAxis >= supportAxis + 20 && powerAxis >= agilityAxis + 10) return 'Athletic';
  if (agilityAxis >= powerAxis + 15) return 'Agile';
  if (supportAxis >= powerAxis + 15) return 'Sturdy';

  return null;
}

function normalizeBodyFrame(value: any): string {
  const bodyFrame = String(value || '').trim();
  return bodyFrame || 'Balanced';
}

function hasOwnProperty(input: AnyRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

export function recomputeCompanionIdentity(
  companionInput: AnyRecord | null | undefined,
  options: { recomputedAt?: string } = {}
): AnyRecord {
  const companion = companionInput || {};
  const identity = deriveCompanionIdentity(companion.trait_affinity);
  const bondLevel = clampStat(Number(companion.bond_level || 0), 0, 100);
  const derivedBodyFrame =
    deriveBodyFrame(companion, identity.build_archetype, identity.trait_affinity) ||
    companion.body_frame;
  const recomputedAt = typeof options.recomputedAt === 'string' && options.recomputedAt
    ? options.recomputedAt
    : new Date().toISOString();

  const patch: AnyRecord = {
    trait_affinity: identity.trait_affinity,
    temperament: identity.temperament,
    build_archetype: identity.build_archetype,
    body_frame: normalizeBodyFrame(derivedBodyFrame),
    bond_level: bondLevel
  };

  // Schema assumption: identity metadata fields may not exist in all environments.
  if (hasOwnProperty(companion, 'identity_version')) {
    const currentVersion = Number(companion.identity_version || 0);
    patch.identity_version = Math.max(currentVersion, SCHEMA_ASSUMPTIONS.identityVersion);
  }
  if (hasOwnProperty(companion, 'identity_last_recalculated_at')) {
    patch.identity_last_recalculated_at = recomputedAt;
  }

  return patch;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

const PUPILBRAIN_FORMAT = 'pupilbrain';
const PUPILBRAIN_VERSION = '2.1.0';

export async function encryptJsonPayload(
  payload: AnyRecord,
  passphrase: string,
  options: { metadata?: AnyRecord; version?: string } = {}
): Promise<AnyRecord> {
  const iterations = 210_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, iterations);
  const plaintext = enc.encode(JSON.stringify(payload));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  const version = String(options.version || PUPILBRAIN_VERSION);

  return {
    format: PUPILBRAIN_FORMAT,
    version,
    export_version: version,
    created_at: new Date().toISOString(),
    metadata: options.metadata || {},
    encryption: {
      alg: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations
    },
    salt_b64: bytesToBase64(salt),
    iv_b64: bytesToBase64(iv),
    ciphertext_b64: bytesToBase64(new Uint8Array(ciphertextBuffer))
  };
}

export async function decryptJsonPayload(
  encryptedPayload: AnyRecord,
  passphrase: string
): Promise<AnyRecord> {
  const format = String(encryptedPayload?.format || '').trim().toLowerCase();
  if (format && format !== PUPILBRAIN_FORMAT) {
    throw new Error('Unsupported export format.');
  }

  const version = String(encryptedPayload?.version || encryptedPayload?.export_version || '').trim();
  if (version && !version.startsWith('2.')) {
    throw new Error(`Unsupported export version: ${version}`);
  }

  const iterations = Number(encryptedPayload?.encryption?.iterations || 210_000);
  if (!Number.isFinite(iterations) || iterations < 100_000 || iterations > 5_000_000) {
    throw new Error('Invalid key derivation settings.');
  }

  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = base64ToBytes(String(encryptedPayload?.salt_b64 || ''));
    iv = base64ToBytes(String(encryptedPayload?.iv_b64 || ''));
    ciphertext = base64ToBytes(String(encryptedPayload?.ciphertext_b64 || ''));
  } catch {
    throw new Error('Encrypted package has invalid base64 fields.');
  }

  if (salt.length < 16 || iv.length !== 12 || ciphertext.length < 16) {
    throw new Error('Encrypted package has invalid cryptographic parameters.');
  }

  const key = await deriveAesKey(passphrase, salt, iterations);
  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  } catch {
    throw new Error('Decryption failed. Check passphrase and package integrity.');
  }

  const plaintext = dec.decode(plaintextBuffer);
  try {
    return JSON.parse(plaintext);
  } catch {
    throw new Error('Decrypted payload is not valid JSON.');
  }
}

export function estimateJsonBytes(value: unknown): number {
  return enc.encode(JSON.stringify(value ?? null)).byteLength;
}

export function clampStat(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function hasTeenageCombatAccess(stage: any): boolean {
  return ['teenager', 'adult'].includes(String(stage || '').trim().toLowerCase());
}

function deriveRosterElement(companion: AnyRecord): string {
  const bySpecies: Record<string, string> = {
    celestial: 'lumen',
    aquatic: 'tide',
    forest: 'vine',
    crystal: 'stone',
    shadow: 'umber'
  };
  const byPath: Record<string, string> = {
    Guardian: 'stone',
    Predator: 'heat',
    Mystic: 'volt',
    Scholar: 'lumen',
    Trickster: 'umber',
    Adaptive: bySpecies[String(companion?.species || '').toLowerCase()] || 'gale'
  };
  return byPath[String(companion?.evolution_path || '')] || bySpecies[String(companion?.species || '').toLowerCase()] || 'gale';
}

function deriveRosterAlignment(companion: AnyRecord): string {
  const byPath: Record<string, string> = {
    Guardian: 'guardian',
    Predator: 'rogue',
    Mystic: 'cipher',
    Scholar: 'cipher',
    Trickster: 'rogue',
    Adaptive: 'cipher'
  };
  const byArchetype: Record<string, string> = {
    Berserker: 'rogue',
    Guardian: 'guardian',
    Oracle: 'cipher',
    Trickster: 'rogue',
    Caretaker: 'guardian',
    Duelist: 'rogue',
    Vanguard: 'guardian',
    Adaptive: 'cipher'
  };
  return byPath[String(companion?.evolution_path || '')] || byArchetype[String(companion?.build_archetype || '')] || 'cipher';
}

function deriveRosterFamily(companion: AnyRecord): string {
  const bySpecies: Record<string, string> = {
    celestial: 'celestials',
    aquatic: 'elementals',
    forest: 'beasts',
    crystal: 'golems',
    shadow: 'undead'
  };
  return bySpecies[String(companion?.species || '').toLowerCase()] || 'elementals';
}

function buildTeenageCombatStats(companion: AnyRecord): AnyRecord {
  const level = Math.max(1, Number(companion?.level || 1));
  const knowledge = Number(companion?.knowledge_level || 0);
  const fitness = Number(companion?.fitness || 0);
  const trust = Number(companion?.trust_level || 0);
  const energy = Number(companion?.personality_energy || 0);
  const curiosity = Number(companion?.personality_curiosity || 0);
  const empathy = Number(companion?.personality_empathy || 0);
  const affinity = normalizeAffinity(companion?.trait_affinity);
  const isAdult = String(companion?.stage || '').toLowerCase() === 'adult';
  const stageBonus = isAdult ? 10 : 0;

  const maxHp = 95 + stageBonus + Math.round(fitness * 0.55) + Math.round(trust * 0.2) + level * 3;

  return {
    hp: maxHp,
    max_hp: maxHp,
    guard: 8 + stageBonus + Math.round((fitness + affinity.nurturing + affinity.disciplined) / 14),
    power: 9 + stageBonus + Math.round((fitness + energy + affinity.aggressive) / 14),
    speed: 8 + Math.round((energy + curiosity + affinity.chaotic) / 16),
    focus: 8 + Math.round((knowledge + curiosity + affinity.disciplined) / 14),
    will: 8 + Math.round((trust + empathy + affinity.nurturing) / 14)
  };
}

function buildTeenageMoveset(companion: AnyRecord, element: string, alignment: string): AnyRecord[] {
  const strikeName = alignment === 'guardian' ? 'Resolve Strike' : alignment === 'rogue' ? 'Instinct Cut' : 'Focus Bolt';
  const skillName = companion?.signature_ability ? 'Signature Surge' : 'Learning Burst';
  const utilityName = alignment === 'guardian' ? 'Guard Stance' : alignment === 'rogue' ? 'Quick Feint' : 'Pattern Read';

  return [
    {
      move_id: 'pupil_strike',
      move_name: strikeName,
      move_type: 'strike',
      taxonomy: 'smash',
      element,
      power: 18,
      accuracy: 92,
      cooldown: 0,
      current_cooldown: 0
    },
    {
      move_id: 'pupil_skill',
      move_name: skillName,
      move_type: 'skill',
      taxonomy: alignment === 'rogue' ? 'trick' : 'blast',
      element,
      power: 26,
      accuracy: 84,
      cooldown: 2,
      current_cooldown: 0
    },
    {
      move_id: 'pupil_guard',
      move_name: utilityName,
      move_type: 'utility',
      taxonomy: 'guard',
      element: 'neutral',
      power: 0,
      accuracy: 100,
      cooldown: 2,
      current_cooldown: 0
    }
  ];
}

export async function ensureCompanionCombatRosterUnit(
  pupil: AnyRecord,
  companion: AnyRecord | null | undefined,
  options: { refreshExisting?: boolean } = {}
): Promise<AnyRecord | null> {
  if (!pupil || !companion?.id || !hasTeenageCombatAccess(companion?.stage)) {
    return null;
  }

  const rosterAccessor = pupil.service?.entities?.PupilRoster;
  let existingRows: AnyRecord[] = [];
  if (rosterAccessor?.filter) {
    try {
      const rows = await rosterAccessor.filter({ companion_id: companion.id });
      existingRows = Array.isArray(rows) ? rows : [];
    } catch {
      existingRows = [];
    }
  }
  const existing = Array.isArray(existingRows)
    ? existingRows.find((unit: AnyRecord) => !unit?.is_temporary_ai && unit?.companion_id !== 'system')
    : null;

  if (existing && !options.refreshExisting) {
    return existing;
  }

  const element = deriveRosterElement(companion);
  const alignment = deriveRosterAlignment(companion);
  const combatStats = buildTeenageCombatStats(companion);
  const patch = {
    companion_id: companion.id,
    creature_template: `teen_${String(companion.species || 'pupil').toLowerCase()}_${alignment}`,
    creature_name: `${companion.name || 'Perfect Pupil'} Battle Form`,
    chassis_family: deriveRosterFamily(companion),
    alignment,
    element,
    evolution_stage: String(companion.stage || 'teenager').toLowerCase(),
    role: alignment === 'guardian' ? 'tank' : alignment === 'rogue' ? 'striker' : 'tactician',
    combat_stats: combatStats,
    moveset: buildTeenageMoveset(companion, element, alignment),
    signature_passive: companion.signature_passive || null,
    signature_ability: companion.signature_ability || null,
    auto_battle_enabled: false,
    tactics_profile: alignment === 'rogue' ? 'aggressive' : 'balanced',
    active_statuses: [],
    is_fainted: false
  };

  if (existing) {
    const preservedStats = existing.combat_stats || {};
    const maxHpChanged = Number(preservedStats.max_hp || 0) !== Number(combatStats.max_hp || 0);
    const nextStats = {
      ...combatStats,
      hp: maxHpChanged ? combatStats.max_hp : Math.max(1, Number(preservedStats.hp || combatStats.max_hp))
    };
    await pupil.service.entities.PupilRoster.update(existing.id, {
      ...patch,
      combat_stats: nextStats,
      total_xp: existing.total_xp || 0,
      total_battles: existing.total_battles || 0,
      wins: existing.wins || 0,
      losses: existing.losses || 0,
      draws: existing.draws || 0
    });
    return { ...existing, ...patch, combat_stats: nextStats };
  }

  return await pupil.entities.PupilRoster.create({
    ...patch,
    total_xp: 0,
    total_battles: 0,
    wins: 0,
    losses: 0,
    draws: 0
  });
}
