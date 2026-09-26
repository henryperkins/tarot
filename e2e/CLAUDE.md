# E2E test guidance (Playwright)

| Mode | Command | Server | Use Case |
|------|---------|--------|----------|
| Frontend | `npm run test:e2e` | Vite (5173) | UI flows, no API |
| Integration | `npm run test:e2e:integration` | Full stack (8787) | API-dependent |

Provider-dependent integration tests require configured credentials. Deterministic
fixtures and local MCP OAuth routing can run without live model credentials; see
the applicable test config and runbook. Never copy production tokens into fixtures.

The journal suite uses its separate config and port 5176 (`npm run test:e2e:journal`).
