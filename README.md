# Perfect Pupil — Windows local edition

The October GitHub changes have been reconciled with this Windows/local-model
edition. See [merge decisions](docs/github-reconciliation.md). Historical hosted
sources and documentation are preserved in [legacy](legacy/README.md).

A companion app with care, evolution, training battles, durable conversation,
editable memories, and interchangeable local/cloud language models. Runs without
Base44, a hosted database, or an account. This is a single-user local application,
not a public multi-user service or a packaged Windows installer.

## Run on Windows

Install Node.js **24.14.x or a newer Node 24 release** (includes npm). The backend
uses Node's built-in SQLite and TypeScript stripping; SQLite is experimental in
this Node release. No database server, Python, Docker, or GPU is required to run
the app in basic mode.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. This starts the local API and Vite together. The
ports are 4318 and 5173, configurable through `.env.local` using `.env.example`.
Both servers bind to loopback. Keep the terminal running; Ctrl+C stops both.

For the production frontend served by the local backend:

```powershell
npm run build
npm start
```

Open **http://127.0.0.1:4318**. The local service still needs to be running for
storage and inference; a cached PWA page does not replace it.

## Storage and privacy

Data is saved in **`%LOCALAPPDATA%\PerfectPupil\pupil.sqlite`**. Set
`PUPIL_DATA_DIR` to choose another directory. Development and production share
this default database. Browser verification uses a separate directory in
`output/browser-data`.

- The SQLite database contains readable conversations, memories, and model-run
  input context. It is **not encrypted**. Protect the Windows account and disk.
- Saved provider keys are encrypted with Windows DPAPI for the current account,
  stored separately from model configuration, and never returned to the browser.
  On other operating systems, use `PUPIL_CLOUD_API_KEY` in the environment.
- Brain exports use the existing AES-256-GCM / PBKDF2 passphrase format. The
  passphrase is used for that request and is not stored.
- Training dataset exports are readable JSON containing conversation context.
  Review and protect them. Revoking consent excludes a run from future exports;
  it cannot retract an already downloaded dataset or undo a trained model.
- Stop the app before copying the **whole data directory** as a full backup.
  DPAPI credentials will generally need to be re-entered on another account/PC.

No existing Base44 database is imported automatically. Existing `.pupilbrain`
packages can be imported through the Stats panel using their passphrase.

## Choose a model

Open **Settings → Manage models and training data** (or Chat → Model settings).

For this Windows NVIDIA PC, `npm run model:setup` installs the verified local
Qwen3-4B Instruct model and llama.cpp CUDA runtime. See
[local model setup and benchmark commands](docs/local-model.md). After saving
its local profile, `npm start` also starts the installed model automatically.

1. **Basic companion** uses openly labelled scripted responses. No model runs and
   no network inference occurs. Care, memories, evolution and combat still work.
2. **Local model** connects to a separately running, compatible chat-completions
   server such as llama.cpp or LM Studio on `localhost` / `127.0.0.1`. Enter its
   API base URL (for example `http://127.0.0.1:8080/v1`) and exact model ID.
3. **Cloud model** connects to a compatible HTTPS API. Cloud processing requires
   explicit opt-in because identity, selected memories, and recent messages are
   sent to that endpoint. Provider terms and costs apply.

Save, then **Test saved connection**. A provider must accept
`POST <base>/chat/completions`, `messages`, `max_tokens`, and
`response_format: {type: "json_object"}`, and return JSON in
`choices[0].message.content`. Arbitrary vendor-specific APIs need another adapter.
Strict JSON schema is also available for servers that support it. There are no
hard-coded model allowlists. The separate setup command downloads model weights;
ordinary app startup does not download them. Switching to a different cloud
endpoint clears its saved credential.

Model failures either show an error or use a labelled basic reply, according to
your setting. Fallback never invokes a different cloud provider. Requests have a
45-second model timeout, bounded responses, cancellation, output validation,
versioned run records, and duplicate-request protection.

The inspected development PC has an RTX 2050 with 4 GiB VRAM and about 16 GiB
system RAM. Real-model benchmarks use isolated test data and record complete
responses, memory and personality checks, latency, token throughput, and GPU
samples. Inference capacity does not establish training capacity.
See the [measured local-model results](docs/benchmark-results.md): 52 scenario
checks, real browser/persistence verification, and observed performance limits.

## Learning and evaluation

Memory and personality state do not change model weights. A model's proposed
memory must be saved explicitly. Training is a separate, optional workflow:

- Allow a chat turn for training, inspect its input context in the Learning lab,
  then approve or reject the generated response.
- Export approved, consented responses. Scripted/fallback replies are excluded,
  exact duplicate examples are removed, and whole sessions stay in one split.
- Use the optional [training workflow](training/README.md) for reviewed-response
  distillation / LoRA adaptation on capable hardware. There is no automatic
  background learning or automatic model promotion.

```powershell
npm run check:release
npm run eval:harness
# Explicitly invokes the currently saved local/cloud model:
npm run eval:harness -- --live --output output/model-evaluation.json
```

Offline evaluation checks harness invariants. Live evaluation adds three small
model smoke scenarios; it is **not** a broad quality or safety certification.

Browser verification starts a fresh isolated local production server itself:

```powershell
npm run build
npm run test:browser
```

Playwright's Chromium must be available (`npx playwright install chromium` if
needed). The browser test refuses to mutate a database outside its isolated test
directory. Each default run creates a fresh test database. To verify an existing
development server instead, set `PUPIL_TEST_URL=http://127.0.0.1:5173` and run that
server with `PUPIL_DATA_DIR` pointing inside `output/browser-data`.

See [architecture](docs/architecture.md) for contracts and limits and
[release checklist](RELEASE_CHECKLIST.md) for remaining release work.

## Contact

Christopher Grillos · Epiphany.AI

Epiphany.AI529@outlook.com · chrisgrillos.cg@gmail.com

[X: @cmgdank](https://x.com/cmgdank)
