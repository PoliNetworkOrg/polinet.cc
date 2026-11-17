# Agent instructions

polinet.cc is PoliNetwork's URL shortener: a Next.js app (App Router) with a REST API (`ts-rest`, OpenAPI at
`/openapi.json`, docs at `/api`), an `/admin` dashboard (shadcn/ui) and PostgreSQL through raw `pg` queries. Other
PoliNetwork services call its API, and the project is meant to stay self-hostable by anyone with a container and a
database.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/[shortCode]/` | The public redirect |
| `src/app/api/[...ts-rest]/route.ts` | REST handlers implementing the contract, with per-endpoint authorization |
| `src/app/admin/`, `src/components/` | Dashboard (server page plus client components); `src/components/ui/` is shadcn output |
| `src/app/auth/`, `src/app/session/` | OIDC login, callback, logout |
| `src/lib/contract.ts` | ts-rest contract: the single source of truth for the API |
| `src/lib/schemas.ts`, `src/lib/validations.ts` | zod schemas for records and inputs, shared by API, server actions and forms |
| `src/lib/url-service.ts`, `src/lib/api-tokens.ts` | All database access, one service class per concern |
| `src/lib/auth.ts` | OIDC config, session, role mapping (`admin` writes, `viewer` reads) |
| `src/lib/actions.ts`, `src/lib/token-actions.ts` | Server actions used by the dashboard |
| `src/sql/init.sql` | Database schema, applied on every start |
| `src/env.ts` | Every environment variable, validated with `@t3-oss/env-nextjs` |

## Commands

```sh
pnpm install
pnpm dev          # http://localhost:6111
pnpm check        # Biome lint and format check (pnpm check:fix to apply)
pnpm test         # Vitest, database tests run on pg-mem
pnpm build        # next build, also the type check
```

`pnpm dev` needs a PostgreSQL database (`DB_HOST`, `DB_USER`, `DB_PASS`, optionally `DB_PORT`, `DB_NAME`, or a single
`DB_URL`) and `SESSION_SECRET`; see `.env.example`. Leave the `OIDC_*` variables empty to run without login: everyone is
an admin and the API needs no token. Tests and builds set `SKIP_ENV_VALIDATION`, which also skips the schema
initialisation in `src/lib/db.ts`.

## Rules

### Configuration is read at runtime

The published image (`ghcr.io/polinetworkorg/polinet.cc`) must work for any deployment without a rebuild.

- Never add `NEXT_PUBLIC_` variables or Docker build arguments for configuration: `next build` inlines them into the
  bundle. Add server variables to `src/env.ts` (and `runtimeEnv`), document them in `.env.example`, and hand what the
  browser needs to client components as props or context, as `DomainProvider` does for the domain.
- Never hardcode `polinet.cc` or any other host: use `env.DOMAIN`.
- Pages whose output depends on runtime settings or the session must not be prerendered (`export const dynamic =
  "force-dynamic"`, see `src/app/admin/page.tsx`).

### API

- Change the contract first (`src/lib/contract.ts`), then the handler, then the dashboard if it uses it. Every endpoint
  declares its success and error responses (`{ error: string }`) and a description saying which role it needs.
- Every handler calls `authorize(headers, canRead | canWrite)` before doing anything. Server actions check the role
  themselves too: hiding a button is not authorization.
- Responses must stay backward compatible for existing API clients: add optional fields and new endpoints rather than
  renaming or removing. A breaking change needs `!` in the commit and a note in the PR.

### Database

- Queries use `$n` placeholders for every value. Identifiers that come from input (sort columns, directions) are checked
  against an allowlist before being interpolated, as in `UrlService.getAllUrls`.
- Multi-statement changes run in a transaction on one client (`BEGIN` / `COMMIT` / `ROLLBACK`, `client.release()` in
  `finally`).
- There is no migration tool: `src/sql/init.sql` runs on every start against the production database. Every statement
  must be idempotent and safe on existing data (`CREATE … IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`,
  `DROP CONSTRAINT IF EXISTS`), and must not rewrite or lock large tables.
- The tests keep their own copy of the schema (`SCHEMA_SQL` in the `*.test.ts` files). Update it with `init.sql`.

### Redirects and privacy

- Redirect targets are `http:` or `https:` URLs only.
- The redirect never waits on bookkeeping: click counting is fire-and-forget and must not be able to fail it.
- Never log or store API tokens (only their SHA-256 hash and display prefix), session contents, IP addresses or user
  agents.

### Code style

Biome decides formatting (2 spaces, no semicolons, ES5 trailing commas, sorted imports). Don't edit `src/components/ui/`
or `src/app/globals.css` by hand beyond what shadcn generates. Comments explain why, not what.

## Tests

- Service and route tests replace the pool with pg-mem (`vi.mock("./db")` or `vi.mock("@/lib/db")`), see
  `src/lib/url-service.test.ts` and `src/app/api/[...ts-rest]/route.test.ts`. Follow that pattern rather than adding a
  real database to the tests.
- A new endpoint gets route tests for success, validation error, 401 without a token and 403 with a viewer token when it
  writes. A schema change gets a test that runs against the previous schema too.

## Deployment and other repositories

- A push to `main` builds `:latest`, and Flux deploys it to production automatically (`polinetwork-cd`,
  `apps/polinetcc/`). Treat a merge to `main` as a release.
- Traffic arrives through a Cloudflare Tunnel and Traefik. Services inside the cluster (the PoliNetwork backend) call
  the API on `polinetcc-service.polinetcc.svc.cluster.local:6111` and do not pass through Cloudflare.
- Production login uses PoliNetwork Auth (`auth.polinetwork.org`) with the `polinetcc:write` and `polinetcc:read`
  permissions mapped to `admin` and `viewer`.
- Changes that need work elsewhere (backend, `polinetwork-cd`, Cloudflare) are tracked as issues in those repositories
  and linked from the PR.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org) for commits and PR titles: `<type>[scope][!]:
<description>`, with an accurate type (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`), a body
when the change needs context, and `!` or a `BREAKING CHANGE:` footer for breaking changes. PRs are squash-merged, so
the PR title (or the only commit's message) becomes the commit on `main`.

Branch from `main`, keep a PR to one change, and reference the issue it closes.

## Before handing back

Run `pnpm check`, `pnpm test` and `pnpm build` (CI runs `biome ci .`, the build and the tests). For UI changes, also
look at the dashboard in a browser, with and without OIDC configured.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
