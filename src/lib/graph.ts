/**
 * Recast — FalkorDB graph storage (PACT-parity).
 *
 * Every workspace is one graph ("recast-ws-<opaque server id>"). Domain entities
 * are nodes; structure lives in relationships
 * (Workspace-[:HAS_PRODUCTION]->Production, Production-[:HAS_ROLE]->Role,
 * ShootBlock-[:FOR_ROLE]->Role, ShootBlock-[:CAST]->Actor, ...). Snapshots are
 * rebuilt EXCLUSIVELY through traversals — no denormalized foreign keys are trusted.
 *
 * Concurrency: every mutation is a single guarded query
 *   MATCH (w:Workspace {key:$wk})
 *   WHERE w.revision = $rev AND w.createdAt = $createdAt
 *   SET w.revision = w.revision + 1
 * FalkorDB executes one query atomically, so exactly one competing writer wins;
 * losers observe an empty result set and surface 409 stale_revision. The createdAt
 * term defeats revision-counter reuse after a reset.
 *
 * There is NO in-memory business-state fallback: if the database is unreachable,
 * operations fail with 503 graph_unavailable.
 */
import { FalkorDB, type Graph } from 'falkordb';
import { randomUUID } from 'node:crypto';
import type {
  AgentMode, AgentReply, Analysis, Decision, Workspace, WorkspaceEdit,
} from './types';
import { buildAnalysis } from './domain';

export class RecastError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RecastError';
  }
}

function dbUrl(): string {
  const url = process.env.FALKORDB_URL?.trim();
  return url && url.length > 0 ? url : 'redis://127.0.0.1:16380';
}

let clientPromise: Promise<FalkorDB> | null = null;

/** Close the shared connection during process/test teardown. */
export async function closeGraphConnection(): Promise<void> {
  const pending = clientPromise;
  clientPromise = null;
  if (pending) await (await pending).close();
}

function unavailable(err: unknown): RecastError {
  const message = err instanceof Error ? err.message : String(err);
  return new RecastError(`Graph storage unavailable: ${message}`, 'graph_unavailable', 503);
}

/** FalkorDB reports "Invalid graph operation on empty key" for a graph that
 *  does not exist yet. Read-only calls treat that as "no such workspace". */
function isGraphMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /empty key/i.test(message) || /graph.*not found/i.test(message);
}

async function getClient(): Promise<FalkorDB> {
  if (!clientPromise) {
    clientPromise = FalkorDB.connect({ url: dbUrl() }).then((client) => {
      client.on('error', () => undefined);
      return client;
    });
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
}

function validateWorkspaceId(id: string): string {
  const trimmed = id.trim();
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(trimmed)) {
    throw new RecastError('Invalid workspace id', 'invalid_workspace_id', 400);
  }
  return trimmed;
}

function graphKey(workspaceId: string): string {
  return `recast-ws-${validateWorkspaceId(workspaceId)}`;
}

async function graphFor(workspaceId: string): Promise<{ g: Graph; wk: string }> {
  try {
    const client = await getClient();
    return { g: client.selectGraph(graphKey(workspaceId)), wk: graphKey(workspaceId) };
  } catch (err) {
    if (err instanceof RecastError) throw err;
    throw unavailable(err);
  }
}

async function run(
  g: Graph,
  query: string,
  params: Record<string, unknown>,
  readonly = false,
): Promise<Record<string, unknown>[]> {
  try {
    const options = { params: params as never };
    const reply = readonly
      ? await g.roQuery<Record<string, unknown>>(query, options)
      : await g.query<Record<string, unknown>>(query, options);
    return reply.data ?? [];
  } catch (err) {
    if (err instanceof RecastError) throw err;
    if (readonly && isGraphMissingError(err)) return [];
    throw unavailable(err);
  }
}

/* --------------------------------- coercers --------------------------------- */

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function nullOrStr(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function boolOrFalse(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false;
}

/* ------------------------------- graph creation ------------------------------ */

export async function createWorkspace(workspaceId: string, fixture: Workspace): Promise<Workspace> {
  const { g, wk } = await graphFor(workspaceId);
  try {
    await g.delete();
  } catch {
    // graph may not exist yet
  }

  const createdAt = fixture.createdAt;
  await run(
    g,
    `CREATE (w:Workspace {key:$wk, workspaceId:$wid, revision:1, createdAt:$createdAt, scenario:$scenario})`,
    { wk, wid: workspaceId, createdAt, scenario: fixture.scenario },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     CREATE (w)-[:HAS_PRODUCTION]->(:Production {id: row.id, title: row.title, contractDate: row.contractDate})`,
    { wk, rows: fixture.productions.map((p) => ({ id: p.id, title: p.title, contractDate: p.contractDate })) },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     MATCH (w)-[:HAS_PRODUCTION]->(p:Production {id: row.productionId})
     CREATE (p)-[:HAS_ROLE]->(:Role {id: row.id, name: row.name, productionId: row.productionId})`,
    { wk, rows: fixture.roles.map((r) => ({ id: r.id, name: r.name, productionId: r.productionId })) },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     CREATE (w)-[:HAS_ACTOR]->(:Actor {id: row.id, name: row.name, maxConsecutiveBlocks: row.maxConsecutiveBlocks})`,
    { wk, rows: fixture.actors.map((a) => ({ id: a.id, name: a.name, maxConsecutiveBlocks: a.maxConsecutiveBlocks })) },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     MATCH (w)-[:HAS_PRODUCTION]->(p:Production {id: row.productionId})
     MATCH (p)-[:HAS_ROLE]->(r:Role {id: row.roleId})
     CREATE (w)-[:HAS_SHOOT_BLOCK]->(sb:ShootBlock {
       id: row.id, label: row.label, productionId: row.productionId, roleId: row.roleId,
       castActorId: row.castActorId, start: row.start, end: row.end, continuityCritical: row.continuityCritical
     })
     CREATE (sb)-[:FOR_PRODUCTION]->(p)
     CREATE (sb)-[:FOR_ROLE]->(r)
     WITH sb, row
     WHERE row.castActorId IS NOT NULL
     MATCH (w)-[:HAS_ACTOR]->(a:Actor {id: row.castActorId})
     CREATE (sb)-[:CAST]->(a)`,
    {
      wk,
      rows: fixture.shootBlocks.map((sb) => ({
        id: sb.id, label: sb.label, productionId: sb.productionId, roleId: sb.roleId,
        castActorId: sb.castActorId, start: sb.start, end: sb.end,
        continuityCritical: boolOrFalse(sb.continuityCritical),
      })),
    },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     MATCH (w)-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: row.roleId})
     CREATE (w)-[:HAS_UNDERSTUDY]->(u:Understudy {
       id: row.id, name: row.name, understudiesRoleId: row.roleId,
       sagAvailabilityValidUntil: row.sagAvailabilityValidUntil
     })
     CREATE (u)-[:UNDERSTUDIES]->(r)`,
    { wk, rows: fixture.understudies.map((u) => ({
      id: u.id, name: u.name, roleId: u.understudiesRoleId, sagAvailabilityValidUntil: u.sagAvailabilityValidUntil,
    })) },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     MATCH (w)-[:HAS_ACTOR]->(a:Actor {id: row.actorId})
     MATCH (w)-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: row.roleId})
     CREATE (w)-[:HAS_LOOK_TEST]->(lt:LookTestScore {actorId: row.actorId, roleId: row.roleId, score: row.score})
     CREATE (lt)-[:FOR_ACTOR]->(a)
     CREATE (lt)-[:FOR_ROLE]->(r)`,
    { wk, rows: fixture.lookTestScores.map((lt) => ({ actorId: lt.actorId, roleId: lt.roleId, score: lt.score })) },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     MATCH (w)-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: row.roleId})
     CREATE (w)-[:HAS_CONTINUITY_NOTE]->(cn:ContinuityNote {
       id: row.id, text: row.text, roleId: row.roleId, requiresHeightMatch: row.requiresHeightMatch
     })
     CREATE (cn)-[:FOR_ROLE]->(r)`,
    { wk, rows: fixture.continuityNotes.map((cn) => ({
      id: cn.id, text: cn.text, roleId: cn.roleId, requiresHeightMatch: boolOrFalse(cn.requiresHeightMatch),
    })) },
  );
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     MATCH (w)-[:HAS_ACTOR]->(a:Actor {id: row.actorId})
     CREATE (w)-[:HAS_UNKNOWN]->(uk:UnknownRequirement {actorId: row.actorId, note: row.note})
     CREATE (uk)-[:FOR_ACTOR]->(a)`,
    { wk, rows: fixture.unknowns.map((u) => ({ actorId: u.actorId, note: u.note })) },
  );

  const rebuilt = await readWorkspace(workspaceId);
  if (!rebuilt) {
    throw new RecastError('Workspace snapshot failed to rebuild after creation', 'snapshot_failed', 500);
  }
  return rebuilt;
}

/* ------------------------------ snapshot rebuild ----------------------------- */
/* Every query projects scalar properties (RETURN n.prop AS prop) — the client does
   not deserialize whole nodes, mirroring the PACT reader contract. */

export async function readWorkspace(workspaceId: string): Promise<Workspace | null> {
  const { g, wk } = await graphFor(workspaceId);

  const metaRows = await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     RETURN w.workspaceId AS workspaceId, w.revision AS revision, w.createdAt AS createdAt, w.scenario AS scenario`,
    { wk },
    true,
  );
  if (metaRows.length === 0) return null;
  const meta = metaRows[0];

  const productions = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_PRODUCTION]->(p:Production)
     RETURN p.id AS id, p.title AS title, p.contractDate AS contractDate ORDER BY id`,
    { wk },
    true,
  )).map((r) => ({ id: str(r['id']), title: str(r['title']), contractDate: str(r['contractDate']) }));

  const roles = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role)
     RETURN r.id AS id, r.name AS name, r.productionId AS productionId ORDER BY id`,
    { wk },
    true,
  )).map((r) => ({ id: str(r['id']), name: str(r['name']), productionId: str(r['productionId']) }));

  const actors = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_ACTOR]->(a:Actor)
     RETURN a.id AS id, a.name AS name, a.maxConsecutiveBlocks AS maxConsecutiveBlocks ORDER BY id`,
    { wk },
    true,
  )).map((r) => ({
    id: str(r['id']),
    name: str(r['name']),
    maxConsecutiveBlocks: num(r['maxConsecutiveBlocks'], 3),
  }));

  const shootBlocks = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_SHOOT_BLOCK]->(sb:ShootBlock)
     RETURN sb.id AS id, sb.label AS label, sb.productionId AS productionId, sb.roleId AS roleId,
            sb.castActorId AS castActorId, sb.start AS start, sb.end AS end,
            sb.continuityCritical AS continuityCritical
     ORDER BY id`,
    { wk },
    true,
  )).map((r) => ({
    id: str(r['id']),
    label: str(r['label']),
    productionId: str(r['productionId']),
    roleId: str(r['roleId']),
    castActorId: nullOrStr(r['castActorId']),
    start: str(r['start']),
    end: str(r['end']),
    continuityCritical: boolOrFalse(r['continuityCritical']),
  }));

  const understudies = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_UNDERSTUDY]->(u:Understudy)
     RETURN u.id AS id, u.name AS name, u.understudiesRoleId AS understudiesRoleId,
            u.sagAvailabilityValidUntil AS sagAvailabilityValidUntil
     ORDER BY id`,
    { wk },
    true,
  )).map((r) => ({
    id: str(r['id']),
    name: str(r['name']),
    understudiesRoleId: str(r['understudiesRoleId']),
    sagAvailabilityValidUntil: nullOrStr(r['sagAvailabilityValidUntil']),
  }));

  const lookTestScores = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_LOOK_TEST]->(lt:LookTestScore)
     RETURN lt.actorId AS actorId, lt.roleId AS roleId, lt.score AS score ORDER BY actorId, roleId`,
    { wk },
    true,
  )).map((r) => ({ actorId: str(r['actorId']), roleId: str(r['roleId']), score: num(r['score'], 0) }));

  const continuityNotes = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_CONTINUITY_NOTE]->(cn:ContinuityNote)
     RETURN cn.id AS id, cn.text AS text, cn.roleId AS roleId,
            cn.requiresHeightMatch AS requiresHeightMatch ORDER BY id`,
    { wk },
    true,
  )).map((r) => ({
    id: str(r['id']),
    text: str(r['text']),
    roleId: str(r['roleId']),
    requiresHeightMatch: boolOrFalse(r['requiresHeightMatch']),
  }));

  const unknowns = (await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_UNKNOWN]->(uk:UnknownRequirement)
     RETURN uk.actorId AS actorId, uk.note AS note ORDER BY actorId`,
    { wk },
    true,
  )).map((r) => ({ actorId: str(r['actorId']), note: str(r['note']) }));

  const scenario = str(meta['scenario']);
  return {
    id: str(meta['workspaceId']) || workspaceId,
    revision: num(meta['revision'], 1),
    scenario: (scenario === 'S2' || scenario === 'S3' ? scenario : 'S1') as Workspace['scenario'],
    createdAt: str(meta['createdAt']),
    productions,
    roles,
    actors,
    shootBlocks,
    dateWindows: [],
    lookTestScores,
    understudies,
    continuityNotes,
    unknowns,
  };
}

/* --------------------------- guarded mutations ------------------------------- */

async function bumpRevision(g: Graph, wk: string, revision: number, createdAt: string): Promise<number> {
  const rows = await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     WHERE w.revision = $rev AND w.createdAt = $createdAt
     SET w.revision = w.revision + 1
     RETURN w.revision AS revision`,
    { wk, rev: revision, createdAt },
  );
  if (rows.length === 0) {
    throw new RecastError('Workspace changed concurrently; reload and retry', 'stale_revision', 409);
  }
  return num(rows[0]['revision']);
}

export async function editWorkspace(
  workspaceId: string,
  revision: number,
  edit: WorkspaceEdit,
): Promise<Workspace> {
  const { g, wk } = await graphFor(workspaceId);
  const wRows = await run(g, `MATCH (w:Workspace {key:$wk}) RETURN w.createdAt AS createdAt`, { wk }, true);
  if (wRows.length === 0) {
    throw new RecastError('Workspace not found', 'workspace_not_found', 404);
  }
  const createdAt = str(wRows[0]['createdAt']);

  await bumpRevision(g, wk, revision, createdAt);

  if (edit.kind === 'recast') {
    // Verify the target actor exists.
    const actorRows = await run(
      g,
      `MATCH (w:Workspace {key:$wk})-[:HAS_ACTOR]->(a:Actor {id:$aid}) RETURN a.id AS id`,
      { wk, aid: edit.actorId },
      true,
    );
    if (actorRows.length === 0) {
      throw new RecastError('Target actor does not exist', 'invalid_actor', 400);
    }
    // Update the cast edge + castActorId property on the shoot block.
    await run(
      g,
      `MATCH (w:Workspace {key:$wk})-[r:HAS_SHOOT_BLOCK]->(sb:ShootBlock {id:$sbid})
       WHERE sb.castActorId IS NOT NULL
       MATCH (sb)-[c:CAST]->(old:Actor) DELETE c
       WITH 1 AS ignored
       MATCH (sb2:ShootBlock {id:$sbid}), (a2:Actor {id:$aid})
       CREATE (sb2)-[:CAST]->(a2)
       SET sb2.castActorId = $aid`,
      { wk, sbid: edit.shootBlockId, aid: edit.actorId },
    );
  } else if (edit.kind === 'reschedule-block') {
    await run(
      g,
      `MATCH (w:Workspace {key:$wk})-[r:HAS_SHOOT_BLOCK]->(sb:ShootBlock {id:$sbid})
       MATCH (a:Actor {id:$aid})
       SET sb.castActorId = $aid
       WITH 1 AS ignored
       MATCH (sb2:ShootBlock {id:$sbid})
       MERGE (sb2)-[:CAST]->(a)`,
      { wk, sbid: edit.shootBlockId, aid: edit.actorId },
    );
  } else {
    // clarify-unknown: remove the UnknownRequirement node, do not guess a replacement.
    await run(
      g,
      `MATCH (w:Workspace {key:$wk})-[h:HAS_UNKNOWN]->(uk:UnknownRequirement {actorId:$aid}) DETACH DELETE uk`,
      { wk, aid: edit.actorId },
    );
  }

  const rebuilt = await readWorkspace(workspaceId);
  if (!rebuilt) {
    throw new RecastError('Workspace snapshot failed to rebuild after edit', 'snapshot_failed', 500);
  }
  return rebuilt;
}

export async function approveProposal(
  workspaceId: string,
  revision: number,
  proposalId: string,
  idempotencyKey: string,
  proposalJson = '',
): Promise<{ workspace: Workspace; decision: Decision }> {
  const { g, wk } = await graphFor(workspaceId);

  const existing = await run(
    g,
    `MATCH (d:Decision {idempotencyKey:$key})-[:DECIDED_ON]->(w:Workspace {key:$wk})
     RETURN d.id AS id, d.proposalId AS proposalId, d.approvedAt AS approvedAt, d.revisionAfter AS revisionAfter`,
    { key: idempotencyKey, wk },
    true,
  );
  if (existing.length > 0) {
    const row = existing[0];
    const rebuilt = await readWorkspace(workspaceId);
    if (!rebuilt) {
      throw new RecastError('Workspace missing during idempotent replay', 'workspace_not_found', 404);
    }
    return {
      workspace: rebuilt,
      decision: {
        id: str(row['id']),
        proposalId: str(row['proposalId']),
        workspaceRevisionAfter: num(row['revisionAfter'], rebuilt.revision),
        idempotencyKey,
        approvedAt: str(row['approvedAt']),
      },
    };
  }

  const wRows = await run(g, `MATCH (w:Workspace {key:$wk}) RETURN w.createdAt AS createdAt`, { wk }, true);
  if (wRows.length === 0) {
    throw new RecastError('Workspace not found', 'workspace_not_found', 404);
  }
  const createdAt = str(wRows[0]['createdAt']);
  const newRevision = await bumpRevision(g, wk, revision, createdAt);

  const decisionId = `dec-${randomUUID().slice(0, 8)}`;
  const approvedAt = new Date().toISOString();
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     CREATE (d:Decision {
       id: $did, proposalId: $pid, idempotencyKey: $key,
       approvedAt: $at, revisionAfter: $rev, proposalJson: $pjson
     })
     CREATE (d)-[:DECIDED_ON]->(w)`,
    { did: decisionId, pid: proposalId, key: idempotencyKey, at: approvedAt, rev: newRevision, pjson: proposalJson, wk },
  );

  const rebuilt = await readWorkspace(workspaceId);
  if (!rebuilt) {
    throw new RecastError('Workspace snapshot failed to rebuild after approval', 'snapshot_failed', 500);
  }
  return {
    workspace: rebuilt,
    decision: {
      id: decisionId,
      proposalId,
      workspaceRevisionAfter: newRevision,
      idempotencyKey,
      approvedAt,
    },
  };
}

/* ---------------------------------- memory ---------------------------------- */

export interface MemoryEntry {
  id: string;
  text: string;
  mode: AgentMode;
  at: string;
}

export async function appendMemory(workspaceId: string, text: string, mode: AgentMode): Promise<void> {
  const { g, wk } = await graphFor(workspaceId);
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     CREATE (w)-[:HAS_MEMORY]->(:Memory {id: $id, text: $text, mode: $mode, at: $at})`,
    { wk, id: `mem-${randomUUID().slice(0, 8)}`, text, mode, at: new Date().toISOString() },
  );
}

export interface UsageEntry {
  id: string;
  workspaceId: string;
  provider: string;
  prompt: string;
  response: string;
  at: string;
}

export async function appendUsage(
  workspaceId: string,
  provider: string,
  response: string,
): Promise<void> {
  const { g, wk } = await graphFor(workspaceId);
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     CREATE (u:Usage {id: $id, provider: $provider, response: $response, at: $at})
     CREATE (w)-[:HAS_USAGE]->(u)`,
    { wk, id: `use-${randomUUID().slice(0, 8)}`, provider, response: response.slice(0, 2000), at: new Date().toISOString() },
  );
}

export async function recentMemory(workspaceId: string, limit = 10): Promise<MemoryEntry[]> {
  const { g, wk } = await graphFor(workspaceId);
  const rows = await run(
    g,
    `MATCH (w:Workspace {key:$wk})-[:HAS_MEMORY]->(m:Memory)
     RETURN m.id AS id, m.text AS text, m.mode AS mode, m.at AS at
     ORDER BY m.at DESC LIMIT $limit`,
    { wk, limit },
    true,
  );
  return rows.map((row) => {
    const mode = str(row['mode']);
    return {
      id: str(row['id']),
      text: str(row['text']),
      mode: (mode === 'live-groq' || mode === 'live-openrouter' ? mode : 'deterministic') as AgentMode,
      at: str(row['at']),
    };
  });
}

/* ---------------------------------- analysis ---------------------------------- */

export async function analyzeWorkspace(
  workspaceId: string,
  revision: number,
): Promise<{ workspace: Workspace; analysis: Analysis }> {
  const { g, wk } = await graphFor(workspaceId);
  const wRows = await run(g, `MATCH (w:Workspace {key:$wk}) RETURN w.revision AS revision, w.createdAt AS createdAt`, { wk }, true);
  if (wRows.length === 0) {
    throw new RecastError('Workspace not found', 'workspace_not_found', 404);
  }
  const metaRevision = Number(wRows[0]['revision']);
  const createdAt = String(wRows[0]['createdAt']);
  if (metaRevision !== revision) {
    throw new RecastError('Workspace changed concurrently; reload and retry', 'stale_revision', 409);
  }

  const workspace = await readWorkspace(workspaceId);
  if (!workspace) {
    throw new RecastError('Workspace snapshot missing', 'snapshot_failed', 500);
  }

  const analysis = buildAnalysis(workspace);
  const ts = new Date().toISOString();
  const activityText = `Plan checked: ${analysis.check.summary ?? 'no findings'}`;

  // Guarded revision bump + persist proposals + an activity row.
  const bump = await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     WHERE w.revision = $rev AND w.createdAt = $createdAt
     SET w.revision = w.revision + 1
     RETURN w.revision AS revision`,
    { wk, rev: revision, createdAt },
  );
  if (bump.length === 0) {
    throw new RecastError('Workspace changed concurrently; reload and retry', 'stale_revision', 409);
  }
  const newRevision = Number(bump[0]['revision']);

  const rows = analysis.proposals.map((p) => ({
    id: p.id, title: p.title, summary: p.summary, revision: newRevision,
    status: p.valid ? 'proposed' : 'rejected', createdAt: ts,
    changesJson: JSON.stringify(p.changes),
  }));
  if (rows.length > 0) {
    await run(
      g,
      `MATCH (w:Workspace {key:$wk})
       WHERE w.revision = $newRev AND w.createdAt = $createdAt
       UNWIND $rows AS pr
       MERGE (p:Proposal {id: pr.id})
       SET p.title = pr.title, p.summary = pr.summary, p.revision = pr.revision,
           p.status = pr.status, p.createdAt = pr.createdAt, p.changes = pr.changesJson
       MERGE (w)-[:HAS_PROPOSAL]->(p)`,
      { wk, newRev: newRevision, createdAt, rows },
    );
  }
  await run(
    g,
    `MATCH (w:Workspace {key:$wk})
     WHERE w.revision = $newRev AND w.createdAt = $createdAt
     CREATE (a:Activity {id: $aid, text: $text, at: $at})
     CREATE (w)-[:HAS_ACTIVITY]->(a)`,
    { wk, newRev: newRevision, createdAt, aid: `act-${randomUUID().slice(0, 8)}`, text: activityText, at: ts },
  );

  const rebuilt = await readWorkspace(workspaceId);
  if (!rebuilt) {
    throw new RecastError('Workspace snapshot failed to rebuild after analysis', 'snapshot_failed', 500);
  }
  return { workspace: rebuilt, analysis };
}

/* ---------------------------------- memory ---------------------------------- */

export async function recallMemory(
  workspaceId: string,
  message: string,
): Promise<{ reply: AgentReply; workspace: Workspace }> {
  const { g, wk } = await graphFor(workspaceId);
  const workspace = await readWorkspace(workspaceId);
  if (!workspace) {
    throw new RecastError('Workspace not found', 'workspace_not_found', 404);
  }

  const lower = (message || '').toLowerCase();
  const lines: string[] = [];

  // Surface the current plan status truthfully.
  const check = buildAnalysis(workspace).check;
  lines.push(`Plan status: ${check.ok ? 'All shoot blocks are covered; no double-booking.' : 'There are open findings.'}`);
  lines.push(`Workspace revision: ${workspace.revision} (notes do not change it).`);

  // Match actors / blocks / roles mentioned in the message.
  const matchWorkspaceText = (text: string): string[] => {
    const t = text.toLowerCase();
    const ids: string[] = [];
    for (const sb of workspace.shootBlocks) {
      if (t.includes(sb.id) || t.includes(sb.label.toLowerCase())) ids.push(sb.id);
    }
    for (const actor of workspace.actors) {
      if (t.includes(actor.id) || t.includes(actor.name.toLowerCase())) ids.push(actor.id);
    }
    for (const role of workspace.roles) {
      if (t.includes(role.id) || t.includes(role.name.toLowerCase())) ids.push(role.id);
    }
    return [...new Set(ids)];
  };

  const matched = matchWorkspaceText(message);
  if (matched.length > 0) {
    for (const id of matched) {
      const sb = workspace.shootBlocks.find((s) => s.id === id);
      if (sb) {
        const actor = sb.castActorId ? workspace.actors.find((a) => a.id === sb.castActorId) : null;
        const role = workspace.roles.find((r) => r.id === sb.roleId);
        const production = workspace.productions.find((p) => p.id === sb.productionId);
        lines.push(
          `- "${sb.label}" (${sb.id}) in ${production?.title ?? sb.productionId}, role ${role?.name ?? sb.roleId},` +
          (actor ? ` cast to ${actor.name}` : ', uncast') +
          `, window ${sb.start} to ${sb.end}`,
        );
      }
      const actor = workspace.actors.find((a) => a.id === id);
      if (actor) {
        lines.push(
          `- Actor ${actor.name} (${actor.id}): maxConsecutiveBlocks ${actor.maxConsecutiveBlocks}`,
        );
      }
      const role = workspace.roles.find((r) => r.id === id);
      if (role) {
        const production = workspace.productions.find((p) => p.id === role.productionId);
        lines.push(`- Role ${role.name} (${role.id}) in ${production?.title ?? role.productionId}`);
      }
    }
  } else if (lower.includes('unknown') || lower.includes('unclear')) {
    for (const u of workspace.unknowns) {
      lines.push(`- Unknown: ${u.actorId} — ${u.note}`);
    }
  } else {
    lines.push(`No specific actor, block, or role matched your note. Mention one for its graph trail.`);
  }

  for (const finding of check.findings.slice(0, 5)) {
    lines.push(`Open finding (${finding.severity}): ${finding.message}`);
  }

  const replyText = lines.join('\n');
  const ts = new Date().toISOString();
  await appendMemory(workspaceId, `Q: ${message}\nA: ${replyText}`, 'deterministic').catch(() => undefined);

  const reply: AgentReply = { mode: 'deterministic', text: replyText, createdAt: ts };
  const rebuilt = await readWorkspace(workspaceId);
  if (!rebuilt) {
    throw new RecastError('Workspace snapshot missing after recall', 'snapshot_failed', 500);
  }
  return { reply, workspace: rebuilt };
}

/* ---------------------------------- health ---------------------------------- */

export async function graphHealth(): Promise<boolean> {
  try {
    const client = await getClient();
    const g = client.selectGraph('recast-health');
    const reply = await g.query<{ ok: number }>('RETURN 1 AS ok');
    return (reply.data?.length ?? 0) === 1;
  } catch {
    return false;
  }
}
