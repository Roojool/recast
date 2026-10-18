/**
 * Recast — deterministic domain unit tests (no database).
 *
 * Verifies checkPlan / proposeRepairs / buildAnalysis / stableId against the
 * S1/S2/S3 fixtures (see BUILD_CONTRACT.md) and hand-built edge cases. All
 * data is fictional.
 *
 * Notes on the current implementation:
 *  - S2's three mutually overlapping blocks on the same role trigger
 *    stage_overcapacity; a dedicated test covers the "pair fits" case with a
 *    custom workspace.
 *  - S3's unknown availability surfaces as a warning only (ok stays true).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { checkPlan, proposeRepairs, buildAnalysis, stableId } from '../src/lib/domain';
import { createFixture } from '../src/lib/business-setup';
import type { Workspace, WorkspaceEdit } from '../src/lib/types';

function coveredWorkspace(id = 'cov-01'): Workspace {
  return {
    id, revision: 1, scenario: 'S1', createdAt: '2026-10-18T08:00:00Z',
    productions: [{ id: 'prod-p', title: 'Production P', contractDate: '2026-01-01T00:00:00Z' }],
    roles: [{ id: 'role-r', name: 'Role R', productionId: 'prod-p' }],
    actors: [{
      id: 'actor-a', name: 'Actor A', maxConsecutiveBlocks: 3,
    }],
    shootBlocks: [{
      id: 'block-1', label: 'Block 1', productionId: 'prod-p', roleId: 'role-r',
      castActorId: 'actor-a',
      start: '2026-10-20T08:00:00Z', end: '2026-10-20T12:00:00Z', continuityCritical: false,
    }],
    dateWindows: [],
    lookTestScores: [],
    understudies: [],
    continuityNotes: [],
    unknowns: [],
  };
}

describe('Recast deterministic domain', () => {
  describe('checkPlan', () => {
    it('S1 hero: flags Vera\'s double-booking across B-7/B-9, ok=false, evidence path production->role->block->actor', () => {
      const ws = createFixture('chk-s1', 'S1');
      const result = checkPlan(ws);
      assert.equal(result.ok, false);
      const dbl = result.findings.find((f) => f.code === 'double_booking');
      assert.ok(dbl, 'expected a double_booking finding');
      assert.equal(dbl.severity, 'critical');
      // evidence path: [productionId, roleId, blockId, actorId]
      const veraFinding = result.findings.find(
        (f) => f.code === 'double_booking' && f.evidencePath.includes('block-b-7') && f.evidencePath.includes('actor-vera'),
      );
      assert.ok(veraFinding, 'expected double_booking for block-b-7 involving actor-vera');
      assert.deepEqual(veraFinding.evidencePath, ['prod-hg', 'role-hg-lead', 'block-b-7', 'actor-vera']);
      const b9Finding = result.findings.find(
        (f) => f.code === 'double_booking' && f.evidencePath.includes('block-b-9') && f.evidencePath.includes('actor-vera'),
      );
      assert.ok(b9Finding, 'expected double_booking for block-b-9 involving actor-vera');
      assert.deepEqual(b9Finding.evidencePath, ['prod-la', 'role-la-lead', 'block-b-9', 'actor-vera']);
    });

    it('S1: recasting B-9 to Mina clears the double_booking finding for B-9', () => {
      const ws = createFixture('chk-s1b', 'S1');
      const changes: WorkspaceEdit[] = [{ kind: 'recast', shootBlockId: 'block-b-9', actorId: 'actor-mina' }];
      const result = checkPlan(ws, changes);
      const b9Double = result.findings.filter(
        (f) => f.code === 'double_booking' && f.evidencePath.includes('block-b-9'),
      );
      assert.equal(b9Double.length, 0, 'Mina recast for B-9 should clear Vera\'s double-booking on B-9');
      // B-7 remains singly cast; no double_booking on B-7 either (Vera now only in B-7).
      const anyDouble = result.findings.find((f) => f.code === 'double_booking');
      assert.equal(anyDouble, undefined, 'no double_booking findings should remain after the recast');
      assert.equal(result.ok, true);
    });

    it('S2: triple overlapping scenes on same role => stage_overcapacity (critical)', () => {
      const ws = createFixture('chk-s2', 'S2');
      const result = checkPlan(ws);
      assert.equal(result.ok, false);
      const over = result.findings.find((f) => f.code === 'stage_overcapacity');
      assert.ok(over, 'expected stage_overcapacity for three mutually overlapping scenes');
      assert.equal(over.severity, 'critical');
    });

    it('S2: pair of scenes can share stage — no critical when only two overlap', () => {
      const ws: Workspace = {
        ...coveredWorkspace('s2-pair'),
        productions: [{ id: 'prod-p', title: 'Production P', contractDate: '2026-01-01T00:00:00Z' }],
        roles: [{ id: 'role-r', name: 'Role R', productionId: 'prod-p' }],
        actors: [
          { id: 'actor-a', name: 'Actor A', maxConsecutiveBlocks: 3 },
          { id: 'actor-b', name: 'Actor B', maxConsecutiveBlocks: 3 },
        ],
        shootBlocks: [
          { id: 'block-1', label: 'Block 1', productionId: 'prod-p', roleId: 'role-r', castActorId: 'actor-a',
            start: '2026-10-20T08:00:00Z', end: '2026-10-20T12:00:00Z', continuityCritical: false },
          { id: 'block-2', label: 'Block 2', productionId: 'prod-p', roleId: 'role-r', castActorId: 'actor-b',
            start: '2026-10-20T09:00:00Z', end: '2026-10-20T13:00:00Z', continuityCritical: false },
        ],
        dateWindows: [], lookTestScores: [], understudies: [], continuityNotes: [], unknowns: [],
      };
      const result = checkPlan(ws);
      assert.equal(result.ok, true, 'two scenes sharing a stage (different actors) is allowed');
      assert.equal(result.findings.filter((f) => f.severity === 'critical').length, 0);
      assert.equal(result.findings.filter((f) => f.code === 'stage_overcapacity').length, 0);
    });

    it('stage conflict: custom workspace with overlapping blocks for the same actor => double_booking', () => {
      const ws: Workspace = {
        ...coveredWorkspace('sc'),
        shootBlocks: [
          { id: 'block-x', label: 'Block X', productionId: 'prod-p', roleId: 'role-r', castActorId: 'actor-a',
            start: '2026-10-20T08:00:00Z', end: '2026-10-21T08:00:00Z', continuityCritical: false },
          { id: 'block-y', label: 'Block Y', productionId: 'prod-p', roleId: 'role-r', castActorId: 'actor-a',
            start: '2026-10-20T12:00:00Z', end: '2026-10-21T12:00:00Z', continuityCritical: false },
        ],
      };
      const result = checkPlan(ws);
      assert.equal(result.ok, false);
      const conflict = result.findings.find((f) => f.code === 'double_booking');
      assert.ok(conflict, 'expected double_booking for overlapping blocks cast to the same actor');
      assert.ok(conflict.evidencePath.some((id) => id === 'block-x') || conflict.evidencePath.some((id) => id === 'block-y'));
    });

    it('S3: unknown availability => warning, ok stays true, no invented look-test findings', () => {
      const ws = createFixture('chk-s3', 'S3');
      const result = checkPlan(ws);
      assert.equal(result.ok, true, 'a warning alone does not fail the bounded check');
      assert.ok(result.findings.find((f) => f.code === 'unknown_availability' && f.severity === 'warning'),
        'expected unknown_availability warning');
      assert.equal(result.findings.filter((f) => f.code === 'double_booking').length, 0);
      assert.equal(result.findings.filter((f) => f.code === 'stage_overcapacity').length, 0);
      // No look-test findings are invented in checkPlan (look tests only matter in repair proposals).
      assert.equal(ws.unknowns.length, 1);
    });

    it('bound: more than MAX_SHOOT_BLOCKS shoot blocks => too_many_shoot_blocks, ok=false', () => {
      const ws = coveredWorkspace('bound');
      ws.shootBlocks = Array.from({ length: 51 }, (_, i) => ({
        id: `block-bulk-${i}`, label: `Bulk ${i}`, productionId: 'prod-p', roleId: 'role-r',
        castActorId: 'actor-a',
        start: '2026-10-20T08:00:00Z', end: '2026-10-20T09:00:00Z', continuityCritical: false,
      }));
      const result = checkPlan(ws);
      assert.equal(result.ok, false);
      assert.ok(result.findings.find((f) => f.code === 'too_many_shoot_blocks'));
    });
  });

  describe('proposeRepairs', () => {
    it('S1: emits a valid recast proposal to Mina for B-9', () => {
      const ws = createFixture('pr-s1', 'S1');
      const proposals = proposeRepairs(ws);
      assert.ok(proposals.length > 0);
      const recast = proposals.find(
        (p) => p.valid && p.changes.some((c) => c.kind === 'recast' && c.shootBlockId === 'block-b-9' && c.toActorId === 'actor-mina'),
      );
      assert.ok(recast, 'expected a valid recast proposal for block-b-9 to Mina');
      const change = recast.changes.find((c) => c.kind === 'recast' && c.shootBlockId === 'block-b-9');
      assert.ok(change, 'recast change present');
      assert.equal(change.toActorId, 'actor-mina');
      assert.equal(change.fromActorId, 'actor-vera');
    });

    it('Cole rejected with evidence: valid=false, invalidReason, rejectedCandidates includes cole', () => {
      const ws = createFixture('pr-s1-rej', 'S1');
      const proposals = proposeRepairs(ws);
      const coleRejected = proposals.find(
        (p) => !p.valid && p.rejectedCandidates.some((r) => r.actorId === 'actor-cole'),
      );
      assert.ok(coleRejected, 'expected Cole to be a rejected candidate');
      assert.equal(coleRejected.valid, false);
      assert.ok(coleRejected.invalidReason, 'invalidReason should carry rejection evidence');
      assert.ok(coleRejected.rejectedCandidates.some((r) => r.actorId === 'actor-cole' && r.reasonCode === 'not_eligible'),
        'Cole should be rejected with reasonCode not_eligible');
      // Cole's rejection reason should mention his failed look test (41/100) and/or height mismatch.
      const coleReason = coleRejected.rejectedCandidates.find((r) => r.actorId === 'actor-cole')!.reason;
      assert.ok(
        coleReason.includes('41') || coleReason.includes('look test') || coleReason.includes('height'),
        `Cole's reason should cite look test or height evidence, got: ${coleReason}`,
      );
    });

    it('returns [] when the plan is already covered', () => {
      const ws = coveredWorkspace();
      assert.equal(proposeRepairs(ws).length, 0);
    });
  });

  describe('buildAnalysis', () => {
    it('assembles check + proposals deterministically', () => {
      const ws = createFixture('ba-s1', 'S1');
      const analysis = buildAnalysis(ws);
      assert.equal(analysis.workspaceRevision, ws.revision);
      assert.equal(analysis.check.ok, false);
      assert.ok(Array.isArray(analysis.proposals));
      assert.deepEqual(buildAnalysis(ws), analysis);
    });
  });

  describe('stableId', () => {
    it('is deterministic and input-sensitive', () => {
      assert.equal(stableId('recast', 'block-b-9', 'actor-mina'), stableId('recast', 'block-b-9', 'actor-mina'));
      assert.notEqual(stableId('recast', 'block-b-9', 'actor-mina'), stableId('recast', 'block-b-9', 'actor-cole'));
      assert.notEqual(stableId('recast', 'block-b-9'), stableId('reject', 'block-b-9'));
    });
  });
});
