This directory is the Spacefast repository build root. The repository's
`sf.jsonc` selects it, installs the shared dependencies with `npm ci` at the
repository root, runs `npm run build` here, and publishes this directory's
`dist` output. The wrapper runs the shared native build and copies its complete
artifact here.

For an existing GitHub connection with saved settings, use:

| Setting | Value |
| --- | --- |
| Root directory | `spacefast/project` |
| Install directory | `.` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Framework preset | `vite` |

The supported local Wrangler profile lets Spacefast inspect the native project
before its generated entry exists. The generated artifact contains its own
Wrangler profile with paths relative to `dist`. Keep the repository's Cloudflare
Wrangler configuration for Cloudflare deployments.

Run `npm run build --prefix spacefast/project` from the repository root to build
this output locally. The repository lockfile remains the dependency source of
truth; this directory needs no separate install or lockfile.

Native scheduled maintenance is included only when `TABLEU_CRONS_ENABLED=true`
is present during the build. Configure the deployment's `TABLEU_CRON_SECRET`
before enabling those schedules.
