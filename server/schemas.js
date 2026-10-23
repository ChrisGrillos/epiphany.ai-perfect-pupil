import { z } from 'zod';

const text = z.string().max(12000);
const id = z.string().min(1).max(128);
const stat = z.number().finite().min(0).max(100);
const base = z.object({}).passthrough();
export const entitySchemas = {
  Companion: z.object({ name: z.string().trim().min(1).max(48), stage: z.enum(['infant', 'child', 'teenager', 'adult']), species: z.enum(['celestial', 'aquatic', 'forest', 'crystal', 'shadow']), hunger: stat, happiness: stat, fitness: stat, knowledge_level: stat, trust_level: stat }).passthrough(),
  CompanionMemory: z.object({ companion_id: id, memory_key: z.string().min(1).max(128), memory_value: text.min(1), memory_type: z.enum(['fact', 'preference', 'event', 'emotion', 'skill']), importance: stat.default(50), tags: z.array(z.string().max(64)).max(32).default([]), is_encrypted: z.literal(false).default(false) }).passthrough(),
  BehaviorRule: z.object({ companion_id: id, rule_name: z.string().min(1).max(160), condition: text, action: text, priority: stat.default(50), is_active: z.boolean().default(true) }).passthrough(),
  ChatSession: z.object({ companion_id: id, title: z.string().max(160), message_count: z.number().int().nonnegative().default(0) }).passthrough(),
  ChatMessage: z.object({ companion_id: id, session_id: id, role: z.enum(['user', 'assistant', 'companion', 'system']), content: text }).passthrough(),
  AIProviderConfig: base, AlgorithmState: base, Battle: base, BattleResult: base, BattleTurn: base,
  Achievement: base, EvolutionAttempt: base, EvolutionPuzzle: base, InteractionLog: base,
  Inventory: base, PupilRoster: base, StoreItem: base, Subscription: base, UserCurrency: base,
  ModelRun: base, ModelVersion: base,
};

// Only user-authored memory and style rules have public CRUD. Game state is changed by commands.
export const publicWriteSchemas = {
  CompanionMemory: entitySchemas.CompanionMemory.pick({ companion_id: true, memory_key: true, memory_value: true, memory_type: true, importance: true, tags: true }).strict(),
  BehaviorRule: entitySchemas.BehaviorRule.pick({ companion_id: true, rule_name: true, condition: true, action: true, priority: true, is_active: true }).extend({ rule_description: text.optional() }).strict(),
};

export const chatInput = z.object({ companion_id: id, session_id: id.optional(), message: z.string().trim().min(1).max(4000), request_id: z.string().uuid(), training_allowed: z.boolean().default(false) }).strict();
export const chatOutput = z.object({
  response: z.string().trim().min(1).max(8000),
  emotion: z.enum(['happy', 'curious', 'thoughtful', 'excited', 'calm', 'sad', 'frustrated', 'neutral']).default('neutral'),
  memories_referenced: z.array(z.string().max(128)).max(12).default([]),
  new_memory: z.object({ key: z.string().min(1).max(128), value: text.min(1), type: z.enum(['fact', 'preference', 'event', 'emotion', 'skill']).default('fact'), importance: stat.default(50), tags: z.array(z.string().max(64)).max(16).default([]) }).nullable().optional(),
}).strict();

export const providerInput = z.object({
  provider_name: z.enum(['builtin', 'local', 'cloud']),
  api_endpoint: z.string().max(2048).default(''), model_name: z.string().max(160).default(''),
  api_key: z.string().max(4096).optional(), clear_api_key: z.boolean().default(false),
  allow_cloud: z.boolean().default(false), fallback_to_default: z.boolean().default(true),
  context_chars: z.number().int().min(4000).max(48000).default(12000),
  max_output_tokens: z.number().int().min(128).max(2048).default(512),
  temperature: z.number().min(0).max(2).default(0.3),
  structured_output: z.enum(['json_object', 'json_schema']).default('json_object'),
}).strict();

export const chatOutputJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['response', 'emotion', 'memories_referenced', 'new_memory'],
  properties: {
    response: { type: 'string' },
    emotion: { type: 'string', enum: ['happy', 'curious', 'thoughtful', 'excited', 'calm', 'sad', 'frustrated', 'neutral'] },
    memories_referenced: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    new_memory: { anyOf: [{ type: 'null' }, {
      type: 'object', additionalProperties: false, required: ['key', 'value', 'type', 'importance', 'tags'],
      properties: { key: { type: 'string' }, value: { type: 'string' }, type: { type: 'string', enum: ['fact', 'preference', 'event', 'emotion', 'skill'] }, importance: { type: 'number', minimum: 0, maximum: 100 }, tags: { type: 'array', items: { type: 'string' }, maxItems: 16 } },
    }] },
  },
};

export function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
