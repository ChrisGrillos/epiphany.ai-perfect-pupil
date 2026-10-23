# Local edition release checklist

- Run Node 24.14+ and `npm ci` on a clean Windows checkout.
- Run `npm run check:release` (lint, type checking, integration tests, offline
  harness evaluation, production build).
- Run `npm run test:browser`, which starts a fresh isolated production service;
  inspect the screenshots and verify no console errors. For development proxy
  verification, run the dev server with an isolated data directory and set
  `PUPIL_TEST_URL=http://127.0.0.1:5173`.
- Test create → care → chat → refresh/restart → memory → battle → rewards.
- Verify an in-progress battle resumes and duplicate round requests are rejected.
- Test encrypted brain export/import, including an incorrect passphrase.
- Test the intended real local model, not just a fixture, with live evaluation.
  Record model ID/revision, context settings, RAM/VRAM and latency measurements.
- Test any intended cloud service separately with explicit consent, JSON output,
  cancellation, bad credentials, provider errors and disabled fallback.
- Verify Windows DPAPI credential persistence after restart and re-entry on
  another Windows account. Protect plaintext local databases and training exports.
- Review dependency advisories. The inherited Tailwind 3 development chain and
  React Router 6 still have advisories requiring separate major-version migration;
  do not run forced dependency upgrades without regression checks.
- Before distribution: add a Windows installer/runtime distribution strategy,
  app signing, update/recovery behavior and a tested backup/restore procedure.
- Before publishing a multi-user service: implement real authentication,
  per-user isolation, operational controls and real billing if required. The
  loopback single-user backend is not a public hosting service.

Training is optional. Do not claim distilled-model quality, retraining capacity,
on-device performance, or privacy properties that have not been measured or
implemented. The app ships without model weights and never trains automatically.
