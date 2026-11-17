# Hammer of Clarity — v1 tickets

Built from [docs/SPEC.md](../../../docs/SPEC.md). Terms and decisions (D1…D33): [CONTEXT.md](../../../CONTEXT.md).

Each ticket is a thin vertical slice: it goes end to end (core → adapters → UI) and leaves the extension working. Work any ticket whose blockers are done. `/clear` between tickets — each one is self-contained.

| # | Ticket | Blocked by |
|---|---|---|
| 01 | [Scaffold + tracer bullet: one site redirects to a block page](01-scaffold-tracer-bullet.md) | — |
| 02 | [Spike: install a ~493k-domain list as one rule](02-spike-large-list.md) | 01 |
| 03 | [State pipeline + "Hammer this site"](03-state-pipeline-hammer-this-site.md) | 01 |
| 04 | [Social and short-video categories](04-social-short-video-categories.md) | 03 |
| 05 | [Adult and gambling categories (bundled lists)](05-adult-gambling-bundled-lists.md) | 02, 04 |
| 06 | [Weekly list refresh](06-weekly-list-refresh.md) | 05 |
| 07 | [Stages](07-stages.md) | 04 |
| 08 | [Block page: reason, redirects, attempts](08-block-page-redirects-attempts.md) | 07 |
| 09 | [Removal requests](09-removal-requests.md) | 07 |
| 10 | [Tamper detection and gentle resets](10-tamper-and-resets.md) | 08, 09 |
| 11 | [Graduation](11-graduation.md) | 10 |
| 12 | [Onboarding](12-onboarding.md) | 05, 08, 10 |
| 13 | [Packaging: icons, license, store readiness](13-packaging.md) | 01 |

```
01 ─┬─ 02 ───────────────────┐
    ├─ 03 ── 04 ─┬───────────┴─ 05 ── 06
    │            └─ 07 ─┬─ 08 ─┐
    │                   └─ 09 ─┴─ 10 ─┬─ 11
    │                                 └─ 12   (12 also needs 05)
    └─ 13
```

Suggested order working alone: 01 → 02 → 03 → 04 → 07 → 08 → 09 → 10 → 11 → 05 → 06 → 12 → 13.
