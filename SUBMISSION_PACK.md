# Recast — Hackathon Submission Pack

**Project:** `recast` (Recast) — Wave 1 flagship #2  
**Slug:** `recast`  
**Domain:** Casting continuity & availability studio  
**Owner org:** Roojool  
**Active phase:** `06_DOCKER_DEPLOY_VIDEO_AND_SUBMISSION_PACK`  
**Shared FalkorDB:** `redis://127.0.0.1:16380` (never port 16379 / pact-preflight)

---

## Pitch

Prove every role can be recast without breaking shooting continuity, union hours, or double-booked talent. Recast runs the PACT parity stack on a FalkorDB graph: productions, roles, shoot blocks, actors, understudies, continuity notes, look tests, and availability windows, with deterministic plan checking, optimistic-concurrency edits, idempotent repair approvals, and truthful agent memory (Groq → OpenRouter → deterministic replay).

## Hero conflict (scenario S1)

Actor **Vera** is double-booked: Block **B-7** (Production "Harbor Grey") and Block **B-9** (Production "Late Amber") overlap 2 days. Harbor Grey holds the earlier contract (tie-break policy), but Vera's look-test score for Late Amber is irreplaceable per continuity notes (hair continuity after an on-camera haircut).

The valid repair: promote Understudy **Mina** for Late Amber B-9 non-continuity coverage days; Vera shoots only the 2 continuity-critical scenes. Rejected candidate: Actor **Cole** (available, but failed look test 41/100 and height-mismatched against continuity note CN-12). Approval fact `"directors-approved-split-day"` re-enables Vera covering both blocks.

Unknown understudy SAG availability surfaces truthfully as `unknown` — never guessed.

## Three scenarios (fixtures)

| Scenario | Conflict | Valid repair |
|---|---|---|
| S1 (hero) | Vera double-booked across Harbor Grey B-7 and Late Amber B-9 | Promote Mina for Late Amber non-continuity days; Vera keeps continuity-critical scenes |
| S2 | Three roles, one green-screen stage — pair of scenes can share, triple cannot | Pair shares; triple is blocked |
| S3 | Understudy with expired/unknown SAG availability window | Truthful "unknown"; block until clarified |

## Stack (cloned verbatim from PACT)

```json
{
  "dependencies": { "falkordb": "6.8.0", "lucide-react": "1.57.0", "next": "16.4.1", "react": "19.3.1", "react-dom": "19.3.1", "zod": "4.6.7" },
  "devDependencies": { "@types/node": "26.6.5", "@types/react": "19.3.0", "@types/react-dom": "19.3.0", "playwright-core": "^1.64.1", "tsx": "4.23.15", "typescript": "7.0.2" }
}
```

Scripts: `dev` / `build` / `start` / `typecheck` (`tsc --noEmit`) / `test` (unit) / `test:integration` (FalkorDB at 16380).

## App API (`src/app/api/[action]/route.ts`)

- `GET /api/workspace` — load or create cookie-bound anonymous workspace (id never accepted from client)
- `POST /api/analyze` `{revision, live?}` — deterministic plan check (+ optional live LLM overlay)
- `PATCH /api/workspace` `{revision, edit}` — optimistic concurrency; stale ⇒ HTTP 409 `stale_revision`
- `POST /api/approve` `{revision, proposalId, idempotencyKey}` — idempotent repair approval
- `POST /api/reset` — fresh fixture workspace
- `POST /api/memory` `{message, live?}` — agent memory Q&A (truthful mode badge)
- `GET /api/health` — status + public capability booleans (never secrets)
- FalkorDB unreachable ⇒ HTTP 503 `{error:"graph_unavailable"}` — no in-memory business-state substitute

## Mandatory UI (12 React 19 components + /blog)

`BusinessSetup`, `DashboardView`, `OverviewView`, `HeroBottleneckCard`, `ConflictEvidenceView`, `RepairComparisonView`, `SavedReceiptsView`, `StudioMemoryView`, `SourceDrawer`, `EditModals`, `Header`, `SkeletonLoader` + `src/app/blog/page.tsx`. Warm Studio Editorial Dark theme cloned from PACT (read-only reference).

## Phase 06 deliverables (DOCKER_DEPLOY_VIDEO_AND_SUBMISSION_PACK)

| Deliverable | Path / Target | Status |
|---|---|---|
| Playwright demo video | `demos/recast-demo.webm` | recorded via `scripts/record-demo.mjs` |
| Dockerfile | `Dockerfile` | written |
| Compose | `compose.yaml` | written (app + FalkorDB) |
| GitHub repo | `Roojool/recast` | ✅ pushed (`5498130..eea76e6`) |
| HF Space (Docker) | `roojool/recast` | ⚠️ 402 Payment Required — Docker Spaces on free cpu-basic require a PRO subscription (account `roojool` not PRO; verified 2026-10-18). Attempted once per policy; not purchased. GitHub + Vercel remain live. |
| Vercel deploy | `recast` | ✅ LIVE at `https://recast-phi.vercel.app` (production `recast-idexf3l4h-roojools-projects.vercel.app`) |
| Submission pack | `SUBMISSION_PACK.md` | this file |
| Rollup tracker | `ALL_SUBMISSIONS_READY.md` | workspace root |
| Phase marker | `.phase_06_DOCKER_DEPLOY_VIDEO_AND_SUBMISSION_PACK.done` | created on completion |

## Local development

```bash
cd falkordb-suite/recast
npm install
cp .env.local.example .env.local   # .env.local is gitignored; FALKORDB_URL=redis://127.0.0.1:16380
npm run dev          # http://127.0.0.1:3000
npm run typecheck
npm run test
npm run test:integration   # needs FalkorDB at 16380
npm run build
```

## Docker

```bash
docker build -t roojool/recast .
docker run -p 3000:3000 --env-file .env.local roojool/recast
# or:
docker compose up
```

## Secrets handling

Runtime secrets (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `SESSION_SECRET`, HF write token) live **only** in `.env.local` (gitignored) and `.commander/secrets.env`. They are **never printed, never committed**. Before any git commit: `git grep -E "hf_|gsk_|sk-or-v1-"` must return empty.

## Data

All fixture data, productions, roles, actors, shoot blocks, and continuity notes are fictional.
