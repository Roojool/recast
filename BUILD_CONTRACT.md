# Recast worker contract

Recast proves a role can be recast without breaking shooting continuity, union hours, or double-booked talent. Read `src/lib/types.ts` as the single source of truth; report any needed change to the orchestrator instead of editing it silently. All fixture data is fictional. No secrets or account details in this repository.

## App API (route handlers under `src/app/api/`)
- `GET /api/workspace` => `{workspace: Workspace}` — load or create the cookie-bound anonymous workspace; never accept a workspace id from the client payload
- `POST /api/analyze` `{revision: number, live?: boolean}` => `{workspace: Workspace, analysis: Analysis}`
- `PATCH /api/workspace` `{revision: number, edit: WorkspaceEdit}` => `{workspace: Workspace}` — optimistic concurrency on `revision`; stale => HTTP 409 `{error: "stale_revision", code: "409"}`
- `POST /api/approve` `{revision: number, proposalId: string, idempotencyKey: string}` => `{workspace: Workspace, decision: Decision}` — idempotent by `idempotencyKey`
- `POST /api/reset` `{}` => `{workspace: Workspace}` — fresh fixture workspace for the selected scenario
- `POST /api/memory` `{message: string, live?: boolean}` => `{reply: AgentReply, workspace: Workspace}` — failover chain Groq -> OpenRouter -> deterministic replay; reply mode is always truthful (`live-groq` | `live-openrouter` | `deterministic`)
- `GET /api/health` => status + public capability booleans (never secrets)
- Errors are `{error: string, code: string}` with HTTP 400/409/429/503. **FalkorDB unreachable => HTTP 503 `{error: "graph_unavailable"}`** — never substitute in-memory business-state.

## Backend module exports
- `src/lib/business-setup.ts`: `createFixture(id: string, scenario: ScenarioId): Workspace` + the three scenarios S1/S2/S3 from `.commander/context/02_WAVE_1_FLAGSHIPS.md`
- `src/lib/domain.ts` (100% deterministic, pure): `checkPlan(workspace, changes?, commitmentIds?): CheckResult`, `proposeRepairs(workspace): Proposal[]` (never mutates input; same input => same output, always)
- `src/lib/graph.ts`: `readWorkspace`, `createWorkspace`, `analyzeWorkspace`, `editWorkspace`, `approveProposal`, `recallMemory`, `graphHealth` — FalkorDB client 6.8.0, per-workspace graph key `recast-ws-<opaque-server-id>`, optimistic Cypher guard `WHERE w.revision = $expectedRevision`, dependencies discovered via real traversals, proposals/decisions/memory persisted, snapshot recovery proven
- `src/lib/agents.ts`: live overlay + memory with Groq -> OpenRouter -> deterministic replay; keys only from env; usage persisted in the graph so restarts cannot erase budget

## Hero dataset (S1)
Actor Vera double-booked: Block B-7 (Production "Harbor Grey") and Block B-9 (Production "Late Amber") overlap 2 days; Harbor Grey holds the earlier contract (tie-break policy) but Vera's look-test score for Late Amber is irreplaceable per continuity notes (hair continuity after on-camera haircut). Valid repair: promote Understudy Mina for Late Amber B-9 non-continuity coverage days; Vera shoots only the 2 continuity-critical scenes. Rejected candidate: Actor Cole (available, but failed look test 41/100 and height-mismatched against continuity note CN-12). Approval fact "directors-approved-split-day" re-enables Vera covering both blocks. Unknown understudy availability surfaces truthfully as unknowns — never guessed.

## Interface worker ownership
`src/app/**`, `src/components/**` only. Warm Studio Editorial Dark theme cloned from PACT (read-only reference `pact/src/app/globals.css`, `dashboard.css`, `setup.css`). All 12 components: BusinessSetup, DashboardView, OverviewView, HeroBottleneckCard, ConflictEvidenceView, RepairComparisonView, SavedReceiptsView, StudioMemoryView, SourceDrawer, EditModals, Header, SkeletonLoader + `/blog`. Every control functional; truthful status badges; honest unavailable states.

## Boundaries
Only modify assigned files. Never modify `pact/`. Strict TypeScript must compile (`tsc --noEmit`). Deterministic core must not depend on network, clock time, or random. Commit messages: `recast: phase <NN> <name>`; before any commit run `git grep -E "hf_|gsk_|sk-or-v1-"` and require empty output.
