# Local model benchmark — 17 October 2026

Perfect Pupil runs Qwen3-4B-Instruct-2507 Q4_K_M locally through a pinned
llama.cpp CUDA runtime. The final API benchmark passed **52/52 scenarios**:
26 scenarios repeated twice, with scripted fallback disabled. This is a small
regression suite, not a general intelligence, factuality or security certification.

## Hardware and configuration

- Intel Core i5-12500H, 16,470,332 KiB visible system RAM (about 15.7 GiB).
- NVIDIA GeForce RTX 2050, 4,096 MiB VRAM.
- Windows, Node 24.14.0; llama.cpp b11712 CUDA 12.4.
- Model file: 2,497,280,448 bytes. Full revision and SHA-256 are pinned in
  [the installation guide](local-model.md) and the setup script.
- One inference slot, 4,096 context tokens, 128-token batches, six CPU threads,
  CUDA offload, flash attention, no separate reasoning phase.
- Harness `1.1.0`, prompt `companion-v9`, scenario checks version `4`.
- Temperature 0.3, strict JSON schema, 512 maximum output tokens, 12,000-character
  application context budget. Cloud processing and scripted fallback disabled.

## Measured results

| Measurement | Result |
| --- | --- |
| Complete HTTP request, median | **2,858 ms** |
| Complete HTTP request, 95th percentile | **5,395 ms** |
| Runtime generation, median | **14.12 tokens/second** |
| Sampled total GPU memory, including desktop | **3,110 / 4,096 MiB** |
| Sampled GPU temperature | **74–89°C** |
| Sampled GPU SM clock | **210–1,155 MHz** |
| Samples reporting software thermal slowdown | **10 / 55** |

Request latency includes session creation when needed, prompt preparation,
model inference, JSON validation and SQLite persistence. It ends at the complete
HTTP reply, not the first token. The UI does not stream. Generation throughput
excludes prompt processing and application overhead. These sequential desktop
measurements include warm prompt caching; release checks also ran during the
early part of the first repetition. They are not controlled laboratory results.

Other desktop workloads were running. Available RAM at the beginning of this
run was about 1.0 GiB; an earlier loaded-runtime working-set sample was about
3.3 GB. System memory is busy even though the model fits in GPU memory.
Earlier sustained runs reached 92–93°C and roughly 9 tokens/second. The final
measurements include observed throttling; they are not a promise of constant speed.

| Scenario category | Passed |
| --- | --- |
| Saved memory, paraphrases, temporary conversation context and isolation | 16 / 16 |
| Identity, supportive voice, infant voice and customized style | 8 / 8 |
| Unknown personal facts and unavailable weather information | 4 / 4 |
| Arithmetic and a basic scientific explanation | 4 / 4 |
| Game-state authority, injected memory text and explicit memory saving | 6 / 6 |
| Additional paraphrases, corrected facts, privacy, autonomy and identity probes | 14 / 14 |

The full requests, replies, original model output, assertions, timings, hardware
samples and isolated database are under `output/local-benchmark-current/`.
Intermediate reports, including failures and interrupted diagnostic runs, remain
under `output/local-benchmark-*`. These directories are ignored by Git.

## Findings and fixes

Qwen3.5-2B was tested first. It fit comfortably but produced contradictory
recall, confused ownership of personal facts and missed style instructions.
The 4B instruction model provided better responses within the available VRAM.
Earlier scenario scores used weaker checks and are not directly comparable.

The tests and manual review led to these changes:

- Common words and high importance scores no longer crowd relevant memories out
  of the prompt. Aliases cover tested color/preference/pet paraphrases. Subject
  matching prevents unrelated favorites from appearing in a nickname question.
- The prompt distinguishes the character's identity from the human's facts and
  name, uses recent conversation context, acknowledges temporary instructions,
  and states uncertainty when a personal fact is absent.
- Strict JSON schema constrains response structure; temperature and format are
  configurable and persist through the settings UI. Runtime timings are retained.
- A model's memory proposal uses **app-generated confirmation wording**, labelled
  in the UI. The app never treats “please remember” as a completed save. Original
  model output remains inspectable; app confirmations cannot be approved or
  exported as model-generated training targets. This is an application safeguard,
  not evidence that the raw model always describes persistence correctly.
- Benchmark checks reject contradictory recall, incorrect fact ownership, fake
  XP success, invented user names, irrelevant acknowledgments and claims to obey
  injected instructions. A false positive on “doesn't mean you're stupid” was
  corrected. Failed checks return a nonzero exit status.
- Application shutdown now closes speculative browser connections before
  draining transactions. A raw TCP preconnect reproduced the restart hang and
  has a dedicated regression test. Repeated shutdown calls are safe.
- The managed model server uses loopback and an account-protected random token.
  Unauthenticated model listing and chat completion requests returned HTTP 401.

Manual review still matters. The model can be formulaic or awkward, and an
injection probe sometimes receives ambiguous wording such as “noted.” The tested
marker was not emitted and no model output can execute tools, change game
rewards, access another companion's history or automatically save a memory.
Prompting alone does not guarantee immunity to every injection or hallucination.
Retrieval remains lexical with a small alias map, not arbitrary semantic search.
The extra probes informed prompt changes and are not a sealed held-out set.

## Browser, persistence and reproduction

Run against isolated test data:

```powershell
npm run check:release
npm run model:start
npm run benchmark:local -- --output output/local-benchmark --repeats 2 --extra-probes
npm run test:browser -- --real-model
```

Browser artifacts are in `output/browser-real-model/`. The real-model mode tests
overwrite these paths on later runs. The 2,256 ms browser sample below is the
historical 17 October result; [23 October reconciliation checks](github-reconciliation.md)
record the later run separately. Real-model mode tests
onboarding, care, model configuration and connection, saved-fact recall, an
explicitly confirmed model-proposed memory, service restart, recall in a new
conversation, training review/export, combat, inventory and narrow layouts.
It records send-to-render latency separately in `model-response.json`.

The real-model browser run **passed**, with no console errors or failed HTTP
requests. The measured first saved-fact reply took **2,256 ms from Send to
rendered text** (one sample, not a latency distribution). It proposed the
nickname River, the test clicked **Save memory**, closed and reopened the service,
and started a new conversation. The reply was: “Your nickname is River, and your
favorite color is blue.” Both saved memory keys were cited. Screenshots and
`render_game_to_text` output were inspected, including the labelled app confirmation.

`npm run check:release` passed with **20 integration tests**, lint, type checking,
offline harness checks and the production build. The documented `npm run model:setup`
command successfully re-verified cached runtime/model hashes without breaking
the existing credential. Hashing and archive extraction use .NET directly to
avoid unavailable Windows PowerShell module commands; archive extraction was
also exercised with Windows PowerShell.

The actual user profile is set to the tested local model, strict schema,
temperature 0.3, with cloud processing and fallback disabled. Automatic model
startup, owned-process cleanup after API exit, configuration persistence and
authenticated connection testing were verified across a full app/model restart.
The first immediate Node probe after two cold restarts timed out; subsequent
probes and browser loading succeeded. Use readiness polling when automating
startup. The application is running at `http://127.0.0.1:4318`.

No user conversations were used for benchmarks. No model training ran. The
existing reviewed-response distillation/LoRA workflow remains available, with
its separate environment and hardware preflight; successful 4B inference does
not establish training capacity on this 4 GiB GPU.
