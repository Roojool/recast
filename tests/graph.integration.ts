/**
 * Recast — FalkorDB integration tests (phase 05).
 *
 * Runs against the shared FalkorDB at redis://127.0.0.1:16380 (FALKORDB_URL
 * from .env.local). Every test uses a unique workspace id so tests never
 * collide; createWorkspace deletes its graph first, so re-runs are safe.
 *
 * Requires `npm run test:integration` (tsx --env-file-if-exists=.env.local).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createWorkspace, readWorkspace, editWorkspace, approveProposal, analyzeWorkspace,
  recallMemory, graphHealth, closeGraphConnection, RecastError,
} from '../src/lib/graph';
import { createFixture } from '../src/lib/business-setup';
import type { Workspace } from '../src/lib/types';

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function freshS1(id: string): Workspace {
  return createFixture(id, 'S1');
}

describe('Recast FalkorDB integration', () => {
  describe('graphHealth', () => {
    it('reports the shared FalkorDB reachable', async () => {
      assert.equal(await graphHealth(), true);
    });
  });

  describe('createWorkspace / readWorkspace', () => {
    it('S1 snapshot rebuild matches the fixture through real traversals', async () => {
      const id = uniqueId('ws-s1');
      const ws = await createWorkspace(id, freshS1(id));
      assert.equal(ws.revision, 1);
      assert.equal(ws.productions.length, 2);
      assert.equal(ws.roles.length, 2);
      assert.equal(ws.actors.length, 3);
      assert.equal(ws.shootBlocks.length, 2);
      assert.equal(ws.understudies.length, 1);
      assert.equal(ws.lookTestScores.length, 3);
      assert.equal(ws.continuityNotes.length, 1);
      assert.equal(ws.unknowns.length, 1);

      // Vera cast to B-7 (Harbor Grey) and B-9 (Late Amber).
      const b7 = ws.shootBlocks.find((b) => b.id === 'block-b-7');
      assert.ok(b7, 'block-b-7 present');
      assert.equal(b7.castActorId, 'actor-vera');
      const b9 = ws.shootBlocks.find((b) => b.id === 'block-b-9');
      assert.ok(b9, 'block-b-9 present');
      assert.equal(b9.castActorId, 'actor-vera');

      // Mina is the understudy for the Late Amber lead role; SAG availability unknown.
      const mina = ws.understudies.find((u) => u.id === 'understudy-mina');
      assert.ok(mina);
      assert.equal(mina.name, 'Mina');
      assert.equal(mina.understudiesRoleId, 'role-la-lead');
      assert.equal(mina.sagAvailabilityValidUntil, null);

      // Cole's look test for the Late Amber lead is 41 (failed).
      const coleScore = ws.lookTestScores.find((lt) => lt.actorId === 'actor-cole' && lt.roleId === 'role-la-lead');
      assert.ok(coleScore);
      assert.equal(coleScore.score, 41);

      // Vera's look test is high (95).
      const veraScore = ws.lookTestScores.find((lt) => lt.actorId === 'actor-vera' && lt.roleId === 'role-la-lead');
      assert.ok(veraScore);
      assert.equal(veraScore.score, 95);

      // CN-12 continuity note for the Late Amber lead, requires height match.
      const cn12 = ws.continuityNotes.find((n) => n.id === 'cn-12');
      assert.ok(cn12);
      assert.equal(cn12.roleId, 'role-la-lead');
      assert.equal(cn12.requiresHeightMatch, true);

      // Mina's unknown availability is recorded.
      assert.ok(ws.unknowns.find((u) => u.actorId === 'actor-mina'));

      // readWorkspace re-reads through traversals and must agree.
      const again = await readWorkspace(id);
      assert.ok(again);
      assert.equal(again.shootBlocks.find((b) => b.id === 'block-b-7')?.castActorId, 'actor-vera');
      assert.equal(again.shootBlocks.find((b) => b.id === 'block-b-9')?.castActorId, 'actor-vera');
    });

    it('readWorkspace returns null for an unknown workspace', async () => {
      const missing = await readWorkspace(uniqueId('nope'));
      assert.equal(missing, null);
    });
  });

  describe('editWorkspace (guarded mutations)', () => {
    it('recast bumps revision and moves the cast actor', async () => {
      const id = uniqueId('ws-recast');
      await createWorkspace(id, freshS1(id));
      const before = await readWorkspace(id);
      assert.ok(before);
      const updated = await editWorkspace(id, before.revision, {
        kind: 'recast', shootBlockId: 'block-b-9', actorId: 'actor-mina',
      });
      assert.equal(updated.revision, before.revision + 1);
      assert.equal(updated.shootBlocks.find((b) => b.id === 'block-b-9')?.castActorId, 'actor-mina');
      // B-7 stays with Vera.
      assert.equal(updated.shootBlocks.find((b) => b.id === 'block-b-7')?.castActorId, 'actor-vera');
    });

    it('stale revision -> 409 stale_revision', async () => {
      const id = uniqueId('ws-stale');
      await createWorkspace(id, freshS1(id));
      const before = await readWorkspace(id);
      assert.ok(before);
      let threw = false;
      try {
        await editWorkspace(id, 9999, {
          kind: 'recast', shootBlockId: 'block-b-9', actorId: 'actor-mina',
        });
      } catch (e) {
        threw = true;
        const err = e as RecastError;
        assert.equal(err.code, 'stale_revision');
        assert.equal(err.status, 409);
      }
      assert.equal(threw, true, 'expected a stale_revision error');
    });
  });

  describe('approveProposal (idempotent repair approval)', () => {
    it('replaying with the same idempotency key returns the same decision and bumps revision once', async () => {
      const id = uniqueId('ws-approve');
      await createWorkspace(id, freshS1(id));
      const { workspace: ws1, analysis } = await analyzeWorkspace(id, 1);
      const proposal = analysis.proposals.find((p) => p.valid);
      assert.ok(proposal, 'expected at least one valid proposal');

      const key = `idem-${uniqueId('key')}`;
      const proposalJson = JSON.stringify({ proposalId: proposal.id });
      const d1 = await approveProposal(id, ws1.revision, proposal.id, key, proposalJson);
      const d2 = await approveProposal(id, ws1.revision, proposal.id, key, proposalJson);

      assert.equal(d2.decision.id, d1.decision.id, 'idempotent replay returns same decision id');
      assert.equal(d2.decision.proposalId, proposal.id);
      assert.equal(d2.decision.workspaceRevisionAfter, d1.decision.workspaceRevisionAfter, 'revision bumped exactly once');
      assert.equal(d2.decision.idempotencyKey, key);
    });
  });

  describe('analyzeWorkspace', () => {
    it('bumps revision and returns check + proposals', async () => {
      const id = uniqueId('ws-analyze');
      await createWorkspace(id, freshS1(id));
      const before = await readWorkspace(id);
      assert.ok(before);
      const { workspace, analysis } = await analyzeWorkspace(id, before.revision);
      assert.equal(workspace.revision, before.revision + 1);
      assert.equal(analysis.check.ok, false);
      assert.ok(Array.isArray(analysis.proposals));
    });
  });

  describe('recallMemory', () => {
    it('returns a deterministic reply mentioning vera / b-7', async () => {
      const id = uniqueId('ws-memory');
      await createWorkspace(id, freshS1(id));
      const { reply } = await recallMemory(id, 'Tell me about Vera and block-b-7');
      assert.equal(reply.mode, 'deterministic');
      assert.ok(reply.text.includes('vera') || reply.text.includes('Vera'), 'reply should reference Vera');
      assert.ok(reply.text.includes('block-b-7') || reply.text.includes('b-7'), 'reply should reference block-b-7');
    });
  });

  describe('503 graph_unavailable', () => {
    it('operations fail with graph_unavailable when FalkorDB is unreachable', async () => {
      const origUrl = process.env.FALKORDB_URL;
      await closeGraphConnection();
      process.env.FALKORDB_URL = 'redis://127.0.0.1:1'; // certainly dead port
      try {
        assert.equal(await graphHealth(), false);
        let threw = false;
        try {
          await createWorkspace(uniqueId('dead'), freshS1(uniqueId('dead')));
        } catch (e) {
          threw = true;
          const err = e as RecastError;
          assert.equal(err.code, 'graph_unavailable');
          assert.equal(err.status, 503);
        }
        assert.equal(threw, true, 'expected graph_unavailable on createWorkspace');
      } finally {
        process.env.FALKORDB_URL = origUrl;
        await closeGraphConnection();
      }
    });
  });
});
