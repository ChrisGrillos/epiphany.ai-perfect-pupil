# Hosted implementation reference

This directory preserves the hosted Base44 source from upstream commit
`26b17df` when it was reconciled with the Windows local edition on 23 October
2026. It is reference material and is not loaded, built or deployed by the
current application.

- `base44/`: original upstream function handlers, entities, agent definitions
  and project configuration. These retain their original hosted dependencies.
- `README-hosted.md`: the upstream product/hosted README, including its contact
  updates and roadmap. Its feature and privacy claims are historical.
- `globals-hosted.css`: the upstream CSS, including automatic system dark mode.
  Active screens retain theme-aware classes and touch optimizations; automatic
  dark-mode activation is deferred until all local-edition screens support it.

Active server code is in `../server/` and `../functions/`; active model/storage
instructions are in the root README and `../docs/`. Hosted-only account deletion,
billing and Base44 agent execution are not exposed in the single-user local UI.
