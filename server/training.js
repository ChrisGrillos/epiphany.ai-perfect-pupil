import { createHash } from 'node:crypto';
import { z } from 'zod';
import { httpError } from './schemas.js';
import { HARNESS_VERSION, PROMPT_VERSION } from './harness.js';

const digest = value => createHash('sha256').update(value).digest('hex');
export function reviewRun(store, raw) {
  const input = z.object({ run_id: z.string(), review: z.enum(['approved', 'rejected', 'unreviewed']), training_allowed: z.boolean() }).strict().parse(raw);
  const run = store.get('ModelRun', input.run_id);
  if (!run) throw httpError('Run not found', 404);
  if (input.review === 'approved' && (!input.training_allowed || run.fallback || run.provider === 'builtin' || run.response_source === 'memory_confirmation')) throw httpError('Only consented, model-generated responses can be approved for training. App memory confirmations are excluded.');
  return store.update('ModelRun', run.id, { review: input.review, training_allowed: input.training_allowed, reviewed_at: new Date().toISOString() });
}

export function exportDataset(store) {
  const seen = new Set();
  const eligible = store.list('ModelRun').filter(r => r.training_allowed && r.review === 'approved' && !r.fallback && r.provider !== 'builtin' && r.response_source !== 'memory_confirmation').filter(run => {
    const key = digest(JSON.stringify({ messages: run.messages, output: run.output }));
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  if (!eligible.length) throw httpError('No approved, consented model responses are available for export.');
  const groups = [...new Set(eligible.map(r => r.session_id))].sort((a, b) => digest(a).localeCompare(digest(b)));
  // A session stays entirely in one split; a one-session dataset has no honest held-out set.
  const evaluationGroups = new Set(groups.length >= 2 ? groups.slice(0, Math.max(1, Math.floor(groups.length * 0.2))) : []);
  const splits = { train: [], evaluation: [] };
  const sources = [];
  for (const run of eligible) {
    const split = evaluationGroups.has(run.session_id) ? 'evaluation' : 'train';
    const example = { messages: [...run.messages, { role: 'assistant', content: JSON.stringify(run.output) }] };
    const line = JSON.stringify(example);
    splits[split].push(line);
    sources.push({ run_id: run.id, session_id: run.session_id, split, sha256: digest(line), teacher_provider: run.provider, teacher_model: run.model, prompt_version: run.prompt_version });
  }
  const train = splits.train.join('\n') + '\n';
  const evaluation = splits.evaluation.join('\n') + (splits.evaluation.length ? '\n' : '');
  return {
    manifest: { format: 'perfect-pupil-dataset-v1', created_at: new Date().toISOString(), harness_version: HARNESS_VERSION, prompt_version: PROMPT_VERSION, split_unit: 'session', training_examples: splits.train.length, evaluation_examples: splits.evaluation.length, train_sha256: digest(train), evaluation_sha256: digest(evaluation), sources, note: 'Contains private conversation context and retrieved memories. Teacher terms and base-model licenses must permit the intended training. This is a reviewed response dataset; no teacher logits are included.' },
    train_jsonl: train, evaluation_jsonl: evaluation,
  };
}

export function registerModel(store, raw) {
  const input = z.object({ name: z.string().trim().min(1).max(120), model_id: z.string().trim().min(1).max(160), base_model: z.string().trim().min(1).max(200), revision: z.string().trim().min(1).max(128), artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/), dataset_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict().parse(raw);
  return store.create('ModelVersion', { ...input, status: 'candidate', evaluation: null });
}
