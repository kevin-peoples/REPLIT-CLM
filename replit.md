# CLM Pro — Contract Lifecycle Management

## Overview

Full-stack Contract Lifecycle Management (CLM) application built as a pnpm monorepo.

## Architecture

- **Frontend**: React + Vite (`artifacts/clm-app`) — served at `/`
- **Backend**: Express 5 API server (`artifacts/api-server`) — served at `/api/*`
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **API Spec**: OpenAPI 3.0 with Orval codegen (`lib/api-spec`, `lib/api-client-react`, `lib/api-zod`)

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **Auth**: Google OAuth 2.0 via Passport.js + PostgreSQL session store (connect-pg-simple)
- **AI**: Anthropic Claude for contract pre-screening
- **Email**: Nodemailer (SMTP)
- **Build**: esbuild

## Key Features

1. **Google OAuth Authentication** — roles: `submitter`, `legal_reviewer`, `designated_signer`, `admin`
2. **Contract Lifecycle** — create → AI screening → legal review → signature → executed upload
3. **AI Pre-Screening** — Anthropic Claude evaluates contracts against configurable criteria (low/medium/high risk)
4. **Configurable Workflows** — approval stages by direction, department, value tier
5. **Obligation & Milestone Tracking** — due date monitoring, overdue alerts
6. **Audit Trail** — full action history with comments
7. **Google Drive Integration** — link to contract documents
8. **SMTP Email Notifications** — signature request emails
9. **Admin Panel** — manage users, contract types, workflows, AI criteria, value tiers
10. **Dashboard** — expiring contracts, obligations due, bottlenecks, reviewer workload

## Database Tables

- `users` — Google OAuth users with roles array
- `contract_types` — configurable contract categories with JSON form schema
- `value_tiers` — financial thresholds for routing
- `workflow_definitions` + `workflow_stages` — configurable approval steps
- `contracts` — main contract records
- `audit_trail` — all contract actions/comments
- `screening_results` — AI screening results with criteria results
- `obligations` — milestones/obligations with due dates
- `dashboard_config` — dashboard display settings
- `screening_criteria` — AI screening criteria (enabled/disabled)

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/clm-app run dev` — run frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Important Notes

- API routes mounted under `/api` prefix in `app.ts`
- Google OAuth callback URL computed from `REPLIT_DOMAINS` env var
- Sessions stored in PostgreSQL (`session` table, auto-created by connect-pg-simple)
- New users default to `submitter` role; admin must grant additional roles
- AI screening reads `screening_criteria` table to determine what to check
- `lib/api-spec/package.json` codegen script patches `api-zod/src/index.ts` post-orval — do NOT revert
- API schemas use `contractName`/`contractValue` (not `title`/`totalValue`)
- Contract directions are `buy`/`sell` (not `inbound`/`outbound`)
