# GitHub reconciliation — 23 October 2026

The local Windows/model build was first committed as `39aced4` and retained on
`codex/windows-local-model-checkpoint-20261023`. The integration branch merges
all 28 upstream commits through `26b17df`, preserving both lines of history.

The active app keeps SQLite, loopback HTTP, DPAPI-protected provider credentials,
local/cloud model adapters, durable sessions, reviewed training exports, model
setup/start supervision, the smoothed avatar and teenage combat support.

Upstream mobile bottom navigation, pull-to-refresh, route transitions, safe-area
spacing, touch targets, care-action feedback and compatible visual changes are
carried into the local app. Navigation is shared outside animated page containers
so its fixed bar works on Home, Dashboard, Battle and Settings. Phone users also
retain access to Memories, Customize, Store and Achievements. Failed care actions
roll back optimistic feedback; failed refreshes reset the gesture and show an error.

The upstream Base44 functions, entity/agent/configuration files and README are
preserved under `legacy/`, rather than replacing the working Node handlers or
reintroducing the Base44 SDK. Local single-user settings retain accurate privacy
and backup information. Hosted account deletion and billing have no local-account
equivalent. Automatic system dark mode remains a reference until all local screens
are theme-compatible; active theme classes and touch improvements are retained.

Weights, local databases, credentials, generated datasets and verification output
are not committed. The existing 17 October benchmark remains a historical result;
the reconciliation verification is recorded in `progress.md`.

Verification on 23 October: clean `npm ci`; release checks (20 integration tests,
lint, type checking, offline harness checks and build); four Python dataset-gate
tests; fixture and real-model browser suites. Browser coverage includes memory
confirmation and new-session recall after restart, care rollback, mobile tab
navigation and pull-to-refresh. Screenshots were inspected. An empty toast layer
that intercepted phone controls was fixed. No model training ran and the earlier
52-scenario performance benchmark was not rerun for this UI merge.

The real-model browser reply took 6,164 ms from Send to rendering in this run
(one sample under the current desktop workload, not a new benchmark distribution).
Both browser runs reported no console errors or failed HTTP requests. `npm audit`
reported five moderate advisories in the inherited Tailwind/PostCSS and React
Router dependency chains, with no high or critical findings. Major dependency
migrations remain separate release work.
