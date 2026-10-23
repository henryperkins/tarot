# Evidence

Type: index
Status: active reference
Last reviewed: 2026-10-23

Canonical root for dated screenshots, JSON checks, and review evidence. Use one folder per topic and date: `evidence/<topic>-<YYYY-MM-DD>/`.

## Index

| Folder | Contents |
| --- | --- |
| [pwa-install-2026-10-08](pwa-install-2026-10-08/README.md) | PWA install control captures, remediation checks, and the PR #102 dock clearance review. |

## Rules

- Use `Type: evidence` and `Status: historical snapshot` in each folder README.
- Put evidence next to the claim it supports, but keep the dated folder under this root.
- Include a `README.md` in each folder with the source revision, viewport/device context, and what the evidence does not prove.
- Do not add a second evidence root. `docs/reviews/evidence/` is a legacy bundle that will move here.
- Do not commit credentials, reviewer identities, or browser session state.
