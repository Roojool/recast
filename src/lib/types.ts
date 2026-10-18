// Recast domain types — single source of truth (see BUILD_CONTRACT.md).
// Mirrors the PACT contract surface: workspace / analyze / repair / approve / memory.
// All fixture data is fictional.

export type ScenarioId = "S1" | "S2" | "S3";

export interface Production {
  id: string;
  title: string;
  contractDate: string; // ISO-8601; earlier contract wins tie-breaks
}

export interface Role {
  id: string;
  name: string;
  productionId: string;
}

export interface Actor {
  id: string;
  name: string;
  maxConsecutiveBlocks: number;
}

/** A shoot day / scene block within a production. */
export interface ShootBlock {
  id: string;
  label: string;
  productionId: string;
  roleId: string;
  castActorId: string | null;
  start: string; // ISO-8601
  end: string; // ISO-8601
  continuityCritical: boolean;
}

/** A date window during which an actor is unavailable. */
export interface DateWindow {
  id: string;
  label: string;
  start: string; // ISO-8601
  end: string; // ISO-8601
}

/** Actor's look-test score for a role (0-100). */
export interface LookTestScore {
  actorId: string;
  roleId: string;
  score: number;
}

export interface Understudy {
  id: string;
  name: string;
  understudiesRoleId: string;
  sagAvailabilityValidUntil: string | null; // ISO-8601; null = unknown
}

export interface ContinuityNote {
  id: string;
  text: string;
  roleId: string;
  requiresHeightMatch: boolean;
}

/** Legacy/unknown requirements that must surface truthfully, never guessed. */
export interface UnknownRequirement {
  actorId: string;
  note: string;
}

export interface Workspace {
  id: string;
  revision: number;
  scenario: ScenarioId;
  createdAt: string; // ISO-8601
  productions: Production[];
  roles: Role[];
  actors: Actor[];
  shootBlocks: ShootBlock[];
  dateWindows: DateWindow[];
  lookTestScores: LookTestScore[];
  understudies: Understudy[];
  continuityNotes: ContinuityNote[];
  unknowns: UnknownRequirement[];
  sources?: string[];
}

export type FindingSeverity = "critical" | "warning" | "info";

export interface Finding {
  id: string;
  severity: FindingSeverity;
  code: string;
  message: string;
  /** Ordered node ids proving the multi-hop traversal (production -> role -> shoot block -> cast actor -> look test / continuity). */
  evidencePath: string[];
}

export interface CheckResult {
  ok: boolean;
  checkedAtRevision: number;
  findings: Finding[];
  /** Human-readable summary of the check result. */
  summary?: string;
}

export type RepairKind = "recast" | "reschedule-block" | "clarify-unknown";

export interface RepairChange {
  kind: RepairKind;
  shootBlockId?: string;
  actorId?: string;
  fromActorId?: string;
  toActorId?: string;
  roleId?: string;
  note?: string;
}

export interface RejectedCandidate {
  actorId: string;
  reasonCode: string;
  reason: string;
}

export interface Proposal {
  id: string;
  title: string;
  summary: string;
  valid: boolean;
  status?: string;
  invalidReason?: string;
  changes: RepairChange[];
  rejectedCandidates: RejectedCandidate[];
  unlocksOriginalDeadline: boolean;
  revision?: number;
  /** New fact that, once approved, re-enables the original deadline. */
  requiresApprovalFact?: string;
}

export interface Decision {
  id: string;
  proposalId: string;
  workspaceRevisionAfter: number;
  idempotencyKey: string;
  approvedAt: string; // ISO-8601
}

export type AgentMode = "live-groq" | "live-openrouter" | "deterministic";

export interface AgentReply {
  mode: AgentMode;
  text: string;
  createdAt: string; // ISO-8601
  warning?: string;
}

export interface Analysis {
  workspaceRevision: number;
  check: CheckResult;
  proposals: Proposal[];
  mode?: AgentMode;
  warning?: string;
}

export type WorkspaceEdit =
  | { kind: "recast"; shootBlockId: string; actorId: string }
  | { kind: "reschedule-block"; shootBlockId: string; actorId: string }
  | {
      kind: "clarify-unknown";
      actorId: string;
      note: string;
    };
