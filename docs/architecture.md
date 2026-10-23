# Local application and model harness

## Boundaries

`src/api/pupilClient.js` sends same-origin HTTP requests. `server/index.js` serves
the production SPA and API on loopback. Development Vite proxies `/api` to that
service. No Base44 SDK, proxy, account, function service, or telemetry is used.

The service issues an HttpOnly SameSite cookie and a separate CSRF token.
Mutations require both; cross-origin requests and non-loopback Host headers are
rejected. This protects the browser-facing local service, not against another
process running as the same Windows user. Do not expose it through a public
proxy or bind it to a LAN address. Multi-user authentication is not implemented.

## Persistence and commands

`server/store.js` owns SQLite, uses WAL/full synchronization, and checks schema
version through `PRAGMA user_version`. Version 1 stores typed JSON records with
entity/owner, companion, and session indexes. Important entities have Zod
schemas; several legacy game records retain flexible payloads. Database changes
must be made as migrations; never reset a user's file to upgrade.

All API record operations are serialized. Every mutating command runs inside
one transaction; validation, handler failures, and disconnected chat requests
roll it back. This preserves multi-record care, inventory, import, achievement,
and combat changes. A slow model request currently holds the serialized command
queue (up to its timeout); moving inference outside the transaction with a
versioned commit protocol is a future optimization.

Existing game handlers in `functions/` are ordinary Node request handlers.
`server/runtime.js` supplies request-scoped data access through AsyncLocalStorage.
The service accessor is available only to server code. Public CRUD is limited
to allowlisted memory/rule fields; inventory, XP, subscriptions, battles, and
model runs are changed through commands. Local edition features are unlocked;
the retained tier names are internal compatibility with the game rules, not
payment entitlements. Real billing and multiplayer are not implemented.

Chat sessions persist across refresh/restart. Imported sessions are marked and
do not silently become live instruction history. Battle rounds require the
expected round number; active training battles can be resumed on refresh.

## Inference contract

`server/providers.js` implements `builtin`, loopback `local`, and opt-in HTTPS
`cloud`. Local/cloud share a JSON chat-completions transport; vendor-specific
protocols can be added behind this boundary. Redirects are rejected. API keys
are passed only in authorization headers; raw provider error bodies and keys
are not logged or returned. Responses are capped at 1 MiB and validated again
against the task output schema. No silent retries or automatic cloud fallback.

The optional Windows installer script pins and hash-checks a llama.cpp CUDA
runtime and GGUF model. `server/local-model.js` starts it only for the matching
active local profile. It uses loopback, one inference slot, an account-protected
random API token, and no model Web UI. The launcher supervises processes it
starts and reuses a matching authenticated server without taking ownership.
The model token is supplied internally by `server/managed-credentials.js`, never
through browser settings or the command line.

`server/harness.js` prepares bounded character-based context:

1. Versioned system instructions and bounded companion identity.
2. Up to 12 memories, ranked by lexical relevance then importance and fitted to
   a character budget. Common words are removed; a small alias map handles
   preference/color/pet paraphrases. Generic preference/name words cannot by
   themselves retrieve an unrelated subject. This remains lexical retrieval,
   not embedding/vector search; arbitrary paraphrases are not guaranteed.
3. Up to eight active style rules, subordinate to system instructions.
4. Up to 12 previous complete user/assistant exchanges, plus the current input.

Character budgets are not exact tokenizer budgets; tune them to the configured
model's context window. Memory/rule text remains untrusted context. Prompting
cannot guarantee immunity to prompt injection. Model output is untrusted JSON;
it cannot directly mutate game stats, tools, files, or memory. Memory suggestions
require a separate user action. Game simulation remains deterministic/rule based.

Memory proposals use app-owned confirmation wording so a model cannot present
a proposal as a completed save. These replies are labelled as app confirmations,
the original model output remains in the run record, and the confirmation is
excluded from training approval/export. Ordinary conversation remains generated
by the selected model.

Each run records request ID/hash, provider/model, prompt/harness versions,
duration, optional token usage and runtime timings, context, output, fallback status, consent and
review. Request IDs are idempotent and cannot be reused for a different payload.
Only successful/fallback chat runs persist; failed/aborted commands roll back
instead of leaving partial conversations. There is no content-bearing telemetry.

## Training and model versions

`server/training.js` exports only consented, approved, non-scripted responses,
deduplicates exact examples, splits whole sessions, and attaches SHA-256 hashes
and teacher provenance. One-session exports have no held-out split; the trainer
rejects them. Review does not certify licensing or factual correctness.

`registerModel` accepts a version name, endpoint model ID, base model, revision,
artifact SHA-256 and optional dataset SHA-256. It records a **candidate** only;
it does not load files, execute code, activate weights, or certify quality.
Keep previous weights/adapters and manifests for rollback. Explicitly select
the model in provider settings after evaluating it. Artifact packaging,
automatic benchmark gates, full-logit distillation and training job management
are future extensions.

`scripts/benchmark-local.mjs` exercises real inference through an isolated
production HTTP API and SQLite database. It records assertions and complete
responses for manual review. Extra probes are part of the regression suite and
have informed prompt changes; they are not a sealed held-out evaluation set.
`npm run test:browser -- --real-model` also verifies model configuration,
memory recall, persisted chat after application-service restart, review/export,
and game workflows using Playwright.

## API summary

- `GET /api/session`, `/api/health`, `/api/profile`, `/api/settings`
- `GET /api/entities/<Entity>?filter=<JSON>&sort=-created_date&limit=30`
- `POST/PATCH/DELETE /api/entities/CompanionMemory` or `BehaviorRule` (ID for edits)
- `POST /api/functions/<Command>`; commands include the existing game handlers,
  `companionChat`, `newChatSession`, `resumeBattle`, `saveAIProviderConfig`,
  `testAIProvider`, `addInventoryItem`, `useInventoryItem`, `reviewModelRun`,
  `exportTrainingDataset`, and `registerModel`.

No file deletion, arbitrary shell execution, model downloading, or model
training endpoint is exposed. The old API specification component is a legacy
design reference; it does not describe this runtime's public routes.
