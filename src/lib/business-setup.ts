/**
 * Recast — synthetic fixtures for the three scenarios described in
 * .commander/context/02_WAVE_1_FLAGSHIPS.md (Wave 1 flagship #2,
 * casting continuity & availability studio).
 *
 * All data is fictional. Every scenario isolates one hero conflict:
 *
 *  - S1 (hero): Actor Vera is double-booked across Block B-7 (Harbor Grey)
 *    and Block B-9 (Late Amber), which overlap 2 days. Harbor Grey holds the
 *    earlier contract (tie-break policy) so Vera keeps B-7, but her look-test
 *    score for the Late Amber Stand-in is 95/100 — irreplaceable per
 *    continuity note CN-12 (hair continuity after an on-camera haircut).
 *    Valid repair: promote Understudy Mina (look test 85, valid SAG window)
 *    for the non-continuity coverage days of B-9; Vera shoots only the 2
 *    continuity-critical scenes. Rejected candidate: Cole (available, but
 *    failed look test 41/100 and height-mismatched against CN-12).
 *    Approval fact "directors-approved-split-day" re-enables Vera covering
 *    both blocks.
 *
 *  - S2: three roles share one green-screen stage — a pair of scenes can
 *    share the stage, a triple cannot (PACT pair-fits pattern). Only two
 *    actors are available, so the third overlapping block is unassigned.
 *
 *  - S3: understudy with an expired SAG availability window — eligibility is
 *    truthfully unknown; the coverage block is blocked until clarified,
 *    never guessed.
 */
import type { ScenarioId, Workspace } from './types';

/** Fixed fictional clock — deterministic, no real time-of-day dependence. */
export const now = () => new Date('2026-10-18T08:00:00Z').toISOString();

function baseWorkspace(id: string, scenario: ScenarioId): Workspace {
  return {
    id,
    revision: 1,
    scenario,
    createdAt: now(),
    productions: [],
    roles: [],
    actors: [],
    shootBlocks: [],
    dateWindows: [],
    lookTestScores: [],
    understudies: [],
    continuityNotes: [],
    unknowns: [],
  };
}

/** S1 — hero: Vera double-booked across B-7 (Harbor Grey) and B-9 (Late Amber). */
function scenarioS1(id: string): Workspace {
  const ws = baseWorkspace(id, 'S1');

  // Harbor Grey signed first — earlier contract wins the tie-break, so Vera
  // keeps B-7 when the two blocks collide.
  ws.productions = [
    { id: 'prod-hg', title: 'Harbor Grey', contractDate: '2026-01-15T00:00:00Z' },
    { id: 'prod-la', title: 'Late Amber', contractDate: '2026-02-01T00:00:00Z' },
  ];

  ws.roles = [
    { id: 'role-hg-lead', name: 'Lead', productionId: 'prod-hg' },
    { id: 'role-la-lead', name: 'Stand-in', productionId: 'prod-la' },
  ];

  ws.actors = [
    { id: 'actor-vera', name: 'Vera', maxConsecutiveBlocks: 3 },
    { id: 'actor-cole', name: 'Cole', maxConsecutiveBlocks: 3 },
    { id: 'actor-mina', name: 'Mina', maxConsecutiveBlocks: 3 },
  ];

  // B-7 and B-9 overlap exactly 2 days (2026-10-21T08:00 -> 2026-10-22T18:00).
  // B-7 (Harbor Grey) is continuity-critical: Vera shoots it herself. B-9
  // (Late Amber) contains continuity-critical scenes that Vera shoots
  // (CN-12 hair continuity) plus non-continuity coverage days that Mina can
  // cover — so the block itself is not flagged continuity-critical at the
  // block level; the continuity note binds the role, not the whole block.
  ws.shootBlocks = [
    {
      id: 'block-b-7',
      label: 'B-7',
      productionId: 'prod-hg',
      roleId: 'role-hg-lead',
      castActorId: 'actor-vera',
      start: '2026-10-20T08:00:00Z',
      end: '2026-10-22T18:00:00Z',
      continuityCritical: true,
    },
    {
      id: 'block-b-9',
      label: 'B-9',
      productionId: 'prod-la',
      roleId: 'role-la-lead',
      castActorId: 'actor-vera',
      start: '2026-10-21T08:00:00Z',
      end: '2026-10-23T18:00:00Z',
      continuityCritical: false,
    },
  ];

  // Vera has no personal unavailability window in S1 — the conflict is the
  // cross-production double booking, not a date window.
  ws.dateWindows = [];

  // Look tests for the Late Amber Stand-in:
  //  - Vera 95  => irreplaceable for the continuity-critical scenes;
  //  - Mina 85  => passes; valid repair target for non-continuity days;
  //  - Cole 41  => failed (< 60); rejected candidate.
  ws.lookTestScores = [
    { actorId: 'actor-vera', roleId: 'role-la-lead', score: 95 },
    { actorId: 'actor-mina', roleId: 'role-la-lead', score: 85 },
    { actorId: 'actor-cole', roleId: 'role-la-lead', score: 41 },
  ];

  // Mina is the designated understudy with a valid (future) SAG window —
  // she is the only clean repair for the non-continuity coverage days.
  ws.understudies = [
    {
      id: 'understudy-mina',
      name: 'Mina',
      understudiesRoleId: 'role-la-lead',
      sagAvailabilityValidUntil: null,
    },
  ];

  // CN-12 binds the Late Amber Stand-in: hair continuity after an on-camera
  // haircut. Any replacement must match Vera's cut, color, and height —
  // Cole fails the height match even before his failed look test is weighed.
  ws.continuityNotes = [
    {
      id: 'cn-12',
      text:
        'CN-12 — Hair continuity after on-camera haircut: the Late Amber Stand-in must match Vera\u2019s cut, color, and height for every continuity-critical scene. No stand-in may shoot the 2 continuity-critical scenes without this match.',
      roleId: 'role-la-lead',
      requiresHeightMatch: true,
    },
  ];

  // Mina's SAG availability window is unconfirmed — surfaced truthfully as an
  // unknown, never guessed at in the repair plan.
  ws.unknowns = [
    {
      actorId: 'actor-mina',
      note: "Mina's SAG availability window has not been confirmed by the union. Eligibility for coverage days is unknown until re-cleared.",
    },
  ];

  return ws;
}

/**
 * S2 — three roles, one green-screen stage (GS-1). A pair of scenes can
 * share the stage; a triple cannot. Only two actors are available, so the
 * third overlapping block is unassigned and must be flagged.
 */
function scenarioS2(id: string): Workspace {
  const ws = baseWorkspace(id, 'S2');

  ws.productions = [
    { id: 'prod-glasshouse', title: 'Glasshouse Run', contractDate: '2026-01-20T00:00:00Z' },
  ];

  // All three roles are shot on the same green-screen stage, GS-1.
  ws.roles = [
    { id: 'role-gs-anchor', name: 'Anchor', productionId: 'prod-glasshouse' },
    { id: 'role-gs-counterpart', name: 'Counterpart', productionId: 'prod-glasshouse' },
    { id: 'role-gs-witness', name: 'Witness', productionId: 'prod-glasshouse' },
  ];

  // Only two actors are available for the GS-1 days.
  ws.actors = [
    { id: 'actor-vera', name: 'Vera', maxConsecutiveBlocks: 3 },
    { id: 'actor-mina', name: 'Mina', maxConsecutiveBlocks: 3 },
  ];

  // Three blocks all overlapping on GS-1 (triple intersection 10:00–14:00).
  // A pair fits (Vera + Mina cover GS-1 · A1 and GS-1 · B1); the triple
  // cannot — the third block is left unassigned.
  ws.shootBlocks = [
    {
      id: 'block-s2-a',
      label: 'GS-1 · A1',
      productionId: 'prod-glasshouse',
      roleId: 'role-gs-anchor',
      castActorId: 'actor-vera',
      start: '2026-10-20T08:00:00Z',
      end: '2026-10-20T14:00:00Z',
      continuityCritical: false,
    },
    {
      id: 'block-s2-b',
      label: 'GS-1 · B1',
      productionId: 'prod-glasshouse',
      roleId: 'role-gs-anchor',
      castActorId: 'actor-mina',
      start: '2026-10-20T09:00:00Z',
      end: '2026-10-20T15:00:00Z',
      continuityCritical: false,
    },
    {
      id: 'block-s2-c',
      label: 'GS-1 · C1',
      productionId: 'prod-glasshouse',
      roleId: 'role-gs-anchor',
      castActorId: null,
      start: '2026-10-20T10:00:00Z',
      end: '2026-10-20T16:00:00Z',
      continuityCritical: false,
    },
  ];

  ws.dateWindows = [];
  ws.lookTestScores = [];
  ws.understudies = [];
  ws.continuityNotes = [];
  ws.unknowns = [];

  return ws;
}

/**
 * S3 — understudy Iris has an expired SAG availability window (2026-10-05,
 * before the fixed clock). Her look test passed (88), so the only open
 * question is SAG eligibility — truthfully unknown, blocked until clarified.
 */
function scenarioS3(id: string): Workspace {
  const ws = baseWorkspace(id, 'S3');

  ws.productions = [
    { id: 'prod-pale-orchard', title: 'Pale Orchard', contractDate: '2026-02-10T00:00:00Z' },
  ];

  ws.roles = [
    { id: 'role-pale-lead', name: 'Lead', productionId: 'prod-pale-orchard' },
  ];

  ws.actors = [
    { id: 'actor-tessa', name: 'Tessa', maxConsecutiveBlocks: 3 },
    { id: 'actor-iris', name: 'Iris', maxConsecutiveBlocks: 3 },
  ];

  // Tessa holds the lead block; Iris (understudy) is scheduled for the
  // coverage day despite her expired SAG window.
  ws.shootBlocks = [
    {
      id: 'block-s3-1',
      label: 'S3-1',
      productionId: 'prod-pale-orchard',
      roleId: 'role-pale-lead',
      castActorId: 'actor-tessa',
      start: '2026-10-20T08:00:00Z',
      end: '2026-10-20T14:00:00Z',
      continuityCritical: true,
    },
    {
      id: 'block-s3-2',
      label: 'S3-2',
      productionId: 'prod-pale-orchard',
      roleId: 'role-pale-lead',
      castActorId: 'actor-iris',
      start: '2026-10-21T08:00:00Z',
      end: '2026-10-21T14:00:00Z',
      continuityCritical: false,
    },
  ];

  ws.dateWindows = [];

  // Iris passed the look test — she is NOT rejected on looks; only her SAG
  // eligibility is in question.
  ws.lookTestScores = [
    { actorId: 'actor-iris', roleId: 'role-pale-lead', score: 88 },
  ];

  // Iris understudies the Pale Orchard lead, but her SAG availability is
  // unknown (re-clearance requested and never received). Surfaced as
  // unknown_availability, never guessed.
  ws.understudies = [
    {
      id: 'understudy-iris',
      name: 'Iris',
      understudiesRoleId: 'role-pale-lead',
      sagAvailabilityValidUntil: null,
    },
  ];

  ws.continuityNotes = [];

  // The only open fact: re-clearance for Iris's SAG window was requested but
  // never received. Eligibility for the 2026-10-21 coverage day is unknown —
  // surface as unknown_availability, block until clarified, never guess.
  ws.unknowns = [
    {
      actorId: 'actor-iris',
      note:
        'SAG availability window expired 2026-10-05; re-clearance requested 2026-10-06 and never received. Eligibility for the 2026-10-21 coverage day is unknown — block until the union confirms.',
    },
  ];

  return ws;
}

/** Build the fixture workspace for the given scenario (default S1, the hero). */
export function createFixture(id: string, scenario: ScenarioId = 'S1'): Workspace {
  switch (scenario) {
    case 'S1':
      return scenarioS1(id);
    case 'S2':
      return scenarioS2(id);
    case 'S3':
      return scenarioS3(id);
  }
}
