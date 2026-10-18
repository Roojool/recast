/**
 * Recast — deterministic bounded plan checker and repair proposer.
 *
 * Pure functions over a Workspace snapshot: no clock, no randomness, no I/O.
 * The same input always produces the same result (including evidence paths).
 *
 * Coverage rules (from the fictional Recast casting-continuity spec):
 *  - A shoot block is properly covered only when its cast actor:
 *      * is not double-booked (no overlapping shoot block on the same actor),
 *      * is not unavailable during the block window (no DateWindow overlap;
 *        DateWindows are union/studio-level unavailability windows — the type
 *        carries no per-actor link — so they apply to every cast actor),
 *      * holds a valid look-test score for the role (score >= LOOK_TEST_PASS,
 *        or truthfully unknown). checkPlan never scores look tests: a missing
 *        or failing score is evidence for repair proposals only, so unknown
 *        eligibility is surfaced, never guessed.
 *      * matches any continuity-note requirement: when a note on the role
 *        requires a height match, only the currently cast reference actor and
 *        verified understudies of that role satisfy it.
 *  - Unknown eligibility (SAG availability null, missing look test) surfaces
 *    truthfully as unknowns — never guessed. UnknownRequirement entries on a
 *    cast actor flag the block until clarified (warning, ok stays true).
 *  - Tie-break: when two overlapping blocks double-book the same actor, the
 *    production with the earlier contractDate keeps the actor; the
 *    later-contract block is the recast candidate (equal dates: earlier
 *    production id wins, then earlier block id — always deterministic).
 *  - An understudy can cover non-continuity scenes only; a continuity-critical
 *    block needs a fully qualified lead.
 *  - An actor may not exceed maxConsecutiveBlocks across the snapshot.
 *  - Stage capacity: a pair of scenes can share a stage (role); a third
 *    mutually overlapping scene on the same role is blocked
 *    (stage_overcapacity).
 *  - Hard bound: more than MAX_SHOOT_BLOCKS shoot blocks =>
 *    too_many_shoot_blocks, ok=false.
 *
 * Approval facts: the committed fact "directors-approved-split-day"
 * (SPLIT_DAY_APPROVAL_FACT) re-enables double-booked talent covering both
 * blocks. checkPlan accepts committed fact ids via `commitmentIds` and
 * downgrades the double_booking finding to an info finding; proposeRepairs
 * always offers the approval-fact proposal while a double_booking stands.
 *
 * The scheduler is deterministic: candidates are evaluated in stable id order
 * and the first legal repair wins.
 */
import type {
  Actor,
  Analysis,
  CheckResult,
  Finding,
  Production,
  Proposal,
  RepairChange,
  RejectedCandidate,
  Role,
  ShootBlock,
  Workspace,
  WorkspaceEdit,
} from './types';

/** Hard bound so the checker always terminates on large snapshots. */
export const MAX_SHOOT_BLOCKS = 50;

/** Look-test score at or above this passes the screen test. */
export const LOOK_TEST_PASS = 60;

/** Approval fact that re-enables double-booked talent covering both blocks. */
export const SPLIT_DAY_APPROVAL_FACT = 'directors-approved-split-day';

/* ------------------------------- primitives ------------------------------- */

/** Parse an ISO-8601 instant to a comparable epoch-ms number. NaN if unparseable. */
function instantMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

/** Do two shoot-block windows overlap (end-exclusive)? */
function windowsOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return instantMs(a.start) < instantMs(b.end) && instantMs(b.start) < instantMs(a.end);
}

function sortedIds(ids: Iterable<string>): string[] {
  return [...ids].sort((x, y) => x.localeCompare(y));
}

function sortedById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((x, y) => x.id.localeCompare(y.id));
}

interface BlockView extends ShootBlock {
  production: Production | null;
  role: Role | null;
  actor: Actor | null;
}

function buildBlockViews(workspace: Workspace, blocks: ShootBlock[]): BlockView[] {
  const productionsById = new Map(workspace.productions.map((p) => [p.id, p]));
  const rolesById = new Map(workspace.roles.map((r) => [r.id, r]));
  const actorsById = new Map(workspace.actors.map((a) => [a.id, a]));
  return sortedById(blocks).map((block) => ({
    ...block,
    production: productionsById.get(block.productionId) ?? null,
    role: rolesById.get(block.roleId) ?? null,
    actor: block.castActorId ? actorsById.get(block.castActorId) ?? null : null,
  }));
}

/**
 * Tie-break for a double-booked pair: the production with the earlier
 * contractDate keeps the actor, so this returns the block to recast (the
 * loser). Equal dates: earlier production id keeps, then earlier block id.
 */
function recastLoser(
  a: BlockView,
  b: BlockView,
  productionsById: Map<string, Production>,
): BlockView {
  const ca = instantMs(productionsById.get(a.productionId)?.contractDate ?? '');
  const cb = instantMs(productionsById.get(b.productionId)?.contractDate ?? '');
  const fa = Number.isFinite(ca);
  const fb = Number.isFinite(cb);
  if (fa !== fb) return fa ? b : a;
  if (fa && ca !== cb) return ca < cb ? b : a;
  const p = a.productionId.localeCompare(b.productionId);
  if (p !== 0) return p < 0 ? b : a;
  return a.id.localeCompare(b.id) < 0 ? b : a;
}

/** Earliest non-null SAG expiry across an actor's understudy records, or null. */
function earliestSagExpiry(workspace: Workspace, actorId: string, actorName: string | null): string | null {
  const records = sortedById(
    workspace.understudies.filter((u) => u.id === actorId || (actorName !== null && u.name === actorName)),
  );
  const expiries = records
    .map((u) => u.sagAvailabilityValidUntil)
    .filter((v): v is string => v !== null && Number.isFinite(instantMs(v)))
    .sort((x, y) => x.localeCompare(y));
  return expiries.length > 0 ? expiries[0] : null;
}

/* ------------------------------- the checker ------------------------------ */

/**
 * Check whether the plan (optionally with repair `changes` applied) covers
 * every shoot block. `commitmentIds` are approval facts already committed for
 * this workspace (e.g. SPLIT_DAY_APPROVAL_FACT); they re-enable the covered
 * conflict and downgrade its finding to info. Deterministic and bounded;
 * never mutates the input.
 */
export function checkPlan(
  workspace: Workspace,
  changes: WorkspaceEdit[] = [],
  commitmentIds: string[] = [],
): CheckResult {
  const findings: Finding[] = [];

  if (workspace.shootBlocks.length > MAX_SHOOT_BLOCKS) {
    const finding: Finding = {
      id: 'finding-bound',
      severity: 'critical',
      code: 'too_many_shoot_blocks',
      message: `Workspace has ${workspace.shootBlocks.length} shoot blocks; the bounded checker supports at most ${MAX_SHOOT_BLOCKS}.`,
      evidencePath: [],
    };
    return { ok: false, checkedAtRevision: workspace.revision, findings: [finding], summary: summarize([finding]) };
  }

  // Apply repair edits logically (non-mutating) to evaluate the resulting
  // plan. Both 'recast' and 'reschedule-block' carry the block's new actor in
  // the current edit shape; 'clarify-unknown' is not a plan change — skip it.
  const modified = new Map(workspace.shootBlocks.map((b) => [b.id, b]));
  for (const change of changes) {
    if (change.kind === 'clarify-unknown') continue;
    const target = modified.get(change.shootBlockId);
    if (!target) continue;
    modified.set(target.id, { ...target, castActorId: change.actorId });
  }

  const views = buildBlockViews(workspace, [...modified.values()]);
  const castViews = views.filter((v) => v.castActorId !== null);
  const productionsById = new Map(workspace.productions.map((p) => [p.id, p]));
  const splitDayCommitted = commitmentIds.includes(SPLIT_DAY_APPROVAL_FACT);

  // 1. Uncast blocks cannot be shot as planned.
  for (const v of views) {
    if (v.castActorId !== null) continue;
    findings.push({
      id: `finding-unassigned-${v.id}`,
      severity: 'critical',
      code: 'unassigned',
      message: `"${v.label}" (${v.id}) in ${v.production?.title ?? v.productionId} has no cast actor; it cannot be shot as planned.`,
      evidencePath: [v.productionId, v.roleId, v.id],
    });
  }

  // 2. Double booking: same actor in overlapping blocks. One finding per
  //    affected block; the earlier-contract production keeps the actor.
  const partners = new Map<string, Set<string>>();
  for (let i = 0; i < castViews.length; i++) {
    for (let j = i + 1; j < castViews.length; j++) {
      const a = castViews[i];
      const b = castViews[j];
      if (a.castActorId !== b.castActorId) continue;
      if (!windowsOverlap(a, b)) continue;
      let pa = partners.get(a.id);
      if (!pa) { pa = new Set<string>(); partners.set(a.id, pa); }
      let pb = partners.get(b.id);
      if (!pb) { pb = new Set<string>(); partners.set(b.id, pb); }
      pa.add(b.id);
      pb.add(a.id);
    }
  }
  for (const v of castViews) {
    const partnerIds = partners.get(v.id);
    if (!partnerIds || partnerIds.size === 0) continue;
    const ids = sortedIds(partnerIds);
    const partnerViews = ids.map((id) => castViews.find((x) => x.id === id)!);
    const keeps = partnerViews.every((p) => recastLoser(v, p, productionsById).id !== v.id);
    const actorName = v.actor?.name ?? v.castActorId!;
    const partnerRefs = partnerViews.map((p) => `"${p.label}" (${p.id})`).join(', ');
    const common =
      `${actorName} is double-booked: "${v.label}" (${v.id}) in ${v.production?.title ?? v.productionId} ` +
      `overlaps ${partnerRefs}. `;
    findings.push({
      id: `finding-double-booking-${v.id}`,
      severity: splitDayCommitted ? 'info' : 'critical',
      code: splitDayCommitted ? 'double_booking_split_day_approved' : 'double_booking',
      message:
        splitDayCommitted
          ? `${common}Committed approval fact "${SPLIT_DAY_APPROVAL_FACT}" re-enables the split day; the original schedule stands.`
          : keeps
            ? `${common}${v.production?.title ?? v.productionId} holds the earlier contract and keeps the actor; the overlapping block(s) must be recast.`
            : `${common}The earlier-contract production keeps the actor, so "${v.label}" is the recast candidate.`,
      evidencePath: [v.productionId, v.roleId, v.id, v.castActorId!],
    });
  }

  // 3. Stage capacity: a pair can share a stage (role); a third mutually
  //    overlapping scene on the same role is blocked.
  const byRole = new Map<string, BlockView[]>();
  for (const v of views) {
    let list = byRole.get(v.roleId);
    if (!list) { list = []; byRole.set(v.roleId, list); }
    list.push(v);
  }
  for (const roleId of sortedIds(byRole.keys())) {
    const roleBlocks = byRole.get(roleId)!;
    outer: for (let i = 0; i < roleBlocks.length; i++) {
      for (let j = i + 1; j < roleBlocks.length; j++) {
        for (let k = j + 1; k < roleBlocks.length; k++) {
          const a = roleBlocks[i];
          const b = roleBlocks[j];
          const c = roleBlocks[k];
          if (windowsOverlap(a, b) && windowsOverlap(a, c) && windowsOverlap(b, c)) {
            findings.push({
              id: `finding-stage-overcapacity-${roleId}`,
              severity: 'critical',
              code: 'stage_overcapacity',
              message: `Three or more scenes (${a.id}, ${b.id}, ${c.id}) overlap on stage/role ${roleId}; only a pair can share the stage.`,
              evidencePath: [roleId, a.id, b.id, c.id],
            });
            break outer;
          }
        }
      }
    }
  }

  // 4. Unavailability windows: a DateWindow overlapping a block window makes
  //    every cast actor in that block unavailable for it.
  const windows = sortedById(workspace.dateWindows);
  for (const v of castViews) {
    for (const w of windows) {
      if (!windowsOverlap(v, w)) continue;
      findings.push({
        id: `finding-unavailable-${v.id}-${w.id}`,
        severity: 'critical',
        code: 'actor_unavailable',
        message: `${v.actor?.name ?? v.castActorId} is unavailable during "${w.label}" (${w.id}, ${w.start} to ${w.end}); it overlaps "${v.label}" (${v.id}).`,
        evidencePath: [v.productionId, v.roleId, v.id, v.castActorId!, w.id],
      });
    }
  }

  // 5. Expired SAG coverage on the cast actor (per-actor availability record).
  for (const v of castViews) {
    const expiry = earliestSagExpiry(workspace, v.castActorId!, v.actor?.name ?? null);
    if (expiry === null) continue;
    if (instantMs(expiry) >= instantMs(v.start)) continue;
    findings.push({
      id: `finding-sag-expired-${v.id}`,
      severity: 'critical',
      code: 'sag_expired',
      message: `${v.actor?.name ?? v.castActorId}'s SAG availability expired ${expiry}, before "${v.label}" (${v.id}) starts ${v.start}.`,
      evidencePath: [v.roleId, v.id, v.castActorId!],
    });
  }

  // 6. Unknown availability: understudy SAG window null => surfaced truthfully.
  for (const u of sortedById(workspace.understudies)) {
    if (u.sagAvailabilityValidUntil !== null) continue;
    findings.push({
      id: `finding-unknown-availability-${u.id}`,
      severity: 'warning',
      code: 'unknown_availability',
      message: `${u.name}'s SAG availability for role ${u.understudiesRoleId} is unknown (no confirmed window); treated as unknown, never guessed.`,
      evidencePath: [u.understudiesRoleId, u.id],
    });
  }

  // 7. Unknown requirements on a cast actor: flag until clarified, never clear.
  for (const v of castViews) {
    const unknown = workspace.unknowns.find((uk) => uk.actorId === v.castActorId);
    if (!unknown) continue;
    findings.push({
      id: `finding-unknown-requirement-${v.id}`,
      severity: 'warning',
      code: 'unknown_requirement',
      message: `${v.actor?.name ?? v.castActorId} has an unknown requirement ("${unknown.note}"); "${v.label}" (${v.id}) stays flagged until clarified, never auto-cleared.`,
      evidencePath: [v.productionId, v.roleId, v.id, v.castActorId!],
    });
  }

  // 8. Consecutive-blocks policy per actor.
  const assigned = new Map<string, string[]>();
  for (const v of castViews) {
    let list = assigned.get(v.castActorId!);
    if (!list) { list = []; assigned.set(v.castActorId!, list); }
    list.push(v.id);
  }
  for (const [actorId, blockIds] of assigned) {
    const actor = workspace.actors.find((a) => a.id === actorId);
    if (!actor || blockIds.length <= actor.maxConsecutiveBlocks) continue;
    findings.push({
      id: `finding-max-consecutive-${actorId}`,
      severity: 'critical',
      code: 'max_consecutive_blocks',
      message: `${actor.name} (${actorId}) is assigned ${blockIds.length} shoot block(s) (${blockIds.join(', ')}), exceeding the max-consecutive-blocks policy of ${actor.maxConsecutiveBlocks}.`,
      evidencePath: [actorId, ...sortedIds(blockIds)],
    });
  }

  const ok = findings.every((f) => f.severity !== 'critical');
  return { ok, checkedAtRevision: workspace.revision, findings, summary: summarize(findings) };
}

function summarize(findings: Finding[]): string {
  if (findings.length === 0) return 'All shoot blocks are covered; no findings.';
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`${counts.critical} critical`);
  if (counts.warning > 0) parts.push(`${counts.warning} warning`);
  if (counts.info > 0) parts.push(`${counts.info} info`);
  const codes = sortedIds(findings.map((f) => f.code)).join(', ');
  return `${parts.join(', ')} finding(s): ${codes}`;
}

/* ------------------------------ the proposer ------------------------------ */

/**
 * Evaluate one candidate actor for one block. Deterministic evidence for
 * rejection; unknown eligibility (no look-test score on a role that is
 * look-tested, unknown SAG) never fabricates a pass or a fail:
 *  - a candidate with rejection evidence => rejected (reasons joined),
 *  - a verified understudy of the role => eligible for non-continuity blocks,
 *  - otherwise => eligible only with a passing look-test score,
 *  - a candidate with unknown eligibility and no rejection evidence yields no
 *    proposal at all — the unknown is surfaced elsewhere, never guessed.
 */
function evaluateCandidate(
  workspace: Workspace,
  block: BlockView,
  candidate: Actor,
  castViews: BlockView[],
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const note = sortedById(
    workspace.continuityNotes.filter((n) => n.roleId === block.roleId),
  )[0];
  const isUnderstudy = workspace.understudies.some(
    (u) => u.understudiesRoleId === block.roleId && (u.id === candidate.id || u.name === candidate.name),
  );

  // Continuity note: height match is satisfied only by the reference (the
  // current cast) or a verified understudy of the role.
  if (note?.requiresHeightMatch && !isUnderstudy) {
    reasons.push(`height-mismatched against continuity note ${note.id} (requires height match)`);
  }

  // Look test: a failing score is hard rejection evidence.
  const lookTest = workspace.lookTestScores.find(
    (lt) => lt.actorId === candidate.id && lt.roleId === block.roleId,
  );
  if (lookTest && lookTest.score < LOOK_TEST_PASS) {
    reasons.push(
      `look test ${lookTest.score}/100 below passing threshold ${LOOK_TEST_PASS} for ${block.role?.name ?? block.roleId}`,
    );
  }

  // Double booking against the target window (excluding the target block itself).
  const overlaps = sortedById(
    castViews.filter((b) => b.id !== block.id && b.castActorId === candidate.id && windowsOverlap(b, block)),
  );
  if (overlaps.length > 0) {
    reasons.push(`double-booked against ${overlaps.map((b) => b.id).join(', ')} (overlapping windows)`);
  }

  // Unavailability windows overlapping the block window.
  const windows = sortedById(workspace.dateWindows.filter((w) => windowsOverlap(w, block)));
  if (windows.length > 0) {
    reasons.push(`unavailable during window(s) ${windows.map((w) => w.id).join(', ')} that overlap the block`);
  }

  // Expired SAG coverage before the block starts.
  const expiry = earliestSagExpiry(workspace, candidate.id, candidate.name);
  if (expiry !== null && instantMs(expiry) < instantMs(block.start)) {
    reasons.push(`SAG availability expired ${expiry}, before the block starts ${block.start}`);
  }

  // Consecutive-blocks policy after adding this block.
  const assignedCount = castViews.filter((b) => b.castActorId === candidate.id).length;
  if (assignedCount + 1 > candidate.maxConsecutiveBlocks) {
    reasons.push(`would exceed max-consecutive-blocks policy (${candidate.maxConsecutiveBlocks})`);
  }

  const eligible =
    reasons.length === 0 &&
    (isUnderstudy
      ? !block.continuityCritical
      : Boolean(lookTest && lookTest.score >= LOOK_TEST_PASS));
  return { eligible, reasons };
}

/**
 * Deterministic repair proposals for the current snapshot. Never mutates the
 * input workspace. Emits clarify-unknown proposals (truthful unknowns), valid
 * recast proposals for the later-contract blocks of double-booked pairs,
 * rejected backup candidates with evidence, and the approval-fact unlock.
 * Same input => same output, always.
 */
export function proposeRepairs(workspace: Workspace): Proposal[] {
  const base = checkPlan(workspace);
  if (base.ok) return [];

  const findings = [...base.findings].sort((a, b) => a.id.localeCompare(b.id));
  const views = buildBlockViews(workspace, workspace.shootBlocks);
  const castViews = views.filter((v) => v.castActorId !== null);
  const actorsById = new Map(workspace.actors.map((a) => [a.id, a]));
  const productionsById = new Map(workspace.productions.map((p) => [p.id, p]));

  const clarifications: Proposal[] = [];
  const recasts: Proposal[] = [];
  const rejections: Proposal[] = [];

  // 1. Unknown availability: clarify before any recast (truthful unknowns).
  for (const finding of findings) {
    if (finding.code !== 'unknown_availability') continue;
    const understudy = workspace.understudies.find((u) => u.id === finding.evidencePath[1]);
    if (!understudy) continue;
    const actor = workspace.actors.find(
      (a) => a.id === understudy.id || a.name === understudy.name,
    );
    const actorId = actor?.id ?? understudy.id;
    const unknown = workspace.unknowns.find((u) => u.actorId === actorId);
    const note = unknown?.note ?? `Confirm the SAG availability window for ${understudy.name} before casting.`;
    const changes: RepairChange[] = [{ kind: 'clarify-unknown', actorId, note }];
    clarifications.push({
      id: `pr-${stableId('clarify', understudy.id)}`,
      title: `Confirm availability for ${understudy.name}`,
      summary: `${understudy.name}'s SAG availability for role ${understudy.understudiesRoleId} is unknown; confirm it before casting. Nothing is guessed in the meantime.`,
      valid: true,
      changes,
      rejectedCandidates: [],
      unlocksOriginalDeadline: false,
    });
  }

  // 2. Double-booked blocks: recast the later-contract block (tie-break).
  for (const finding of findings) {
    if (finding.code !== 'double_booking') continue;
    const blockId = finding.evidencePath[2];
    const block = views.find((b) => b.id === blockId);
    if (!block) continue;
    const recastTargets = isRecastTarget(block, views, productionsById);
    if (!recastTargets) continue;

    for (const candidate of sortedById(workspace.actors)) {
      if (candidate.id === block.castActorId) continue;
      const { eligible, reasons } = evaluateCandidate(workspace, block, candidate, castViews);
      if (reasons.length > 0) {
        const reason = reasons.join('; ');
        const rejected: RejectedCandidate[] = [{ actorId: candidate.id, reasonCode: 'not_eligible', reason }];
        const changes: RepairChange[] = [{
          kind: 'recast',
          shootBlockId: block.id,
          fromActorId: block.castActorId ?? undefined,
          toActorId: candidate.id,
          roleId: block.roleId,
          note: reason,
        }];
        rejections.push({
          id: `pr-${stableId('reject', block.id, candidate.id)}`,
          title: `Rejected: ${candidate.name} for "${block.label}"`,
          summary: `Backup candidate ${candidate.name} considered and rejected: ${reason}. The option stays closed until new evidence arrives.`,
          valid: false,
          invalidReason: reason,
          changes,
          rejectedCandidates: rejected,
          unlocksOriginalDeadline: false,
        });
        continue;
      }
      if (!eligible) continue; // unknown eligibility — surfaced, never guessed.
      const fromName = block.castActorId ? actorsById.get(block.castActorId)?.name ?? block.castActorId : 'the current cast';
      const isUnderstudy = workspace.understudies.some(
        (u) => u.understudiesRoleId === block.roleId && (u.id === candidate.id || u.name === candidate.name),
      );
      // No confirmed SAG record (null or absent) is an unknown, never a pass.
      const sagUnknown = earliestSagExpiry(workspace, candidate.id, candidate.name) === null;
      const changes: RepairChange[] = [{
        kind: 'recast',
        shootBlockId: block.id,
        fromActorId: block.castActorId ?? undefined,
        toActorId: candidate.id,
        roleId: block.roleId,
        note: sagUnknown
          ? `SAG availability is not confirmed for ${candidate.name}; the union window must be verified before the first shoot day.`
          : undefined,
      }];
      recasts.push({
        id: `pr-${stableId('recast', block.id, candidate.id)}`,
        title: `Recast "${block.label}" from ${fromName} to ${candidate.name}`,
        summary:
          `Recast "${block.label}" (${block.id}) in ${block.production?.title ?? block.productionId} from ${fromName} to ${candidate.name}` +
          ` for role ${block.role?.name ?? block.roleId}.` +
          (isUnderstudy ? ' Understudy coverage is valid for this non-continuity scene.' : '') +
          (sagUnknown ? ' SAG availability is an open unknown and stays flagged until confirmed.' : ''),
        valid: true,
        changes,
        rejectedCandidates: [],
        unlocksOriginalDeadline: false,
      });
    }
  }

  // 3. Uncast blocks: propose casting from the eligible pool (no from-actor).
  for (const finding of findings) {
    if (finding.code !== 'unassigned') continue;
    const blockId = finding.evidencePath[2];
    const block = views.find((b) => b.id === blockId);
    if (!block) continue;
    for (const candidate of sortedById(workspace.actors)) {
      const { eligible, reasons } = evaluateCandidate(workspace, block, candidate, castViews);
      if (reasons.length > 0) {
        const reason = reasons.join('; ');
        const rejected: RejectedCandidate[] = [{ actorId: candidate.id, reasonCode: 'not_eligible', reason }];
        const changes: RepairChange[] = [{
          kind: 'recast',
          shootBlockId: block.id,
          toActorId: candidate.id,
          roleId: block.roleId,
          note: reason,
        }];
        rejections.push({
          id: `pr-${stableId('reject', block.id, candidate.id)}`,
          title: `Rejected: ${candidate.name} for "${block.label}"`,
          summary: `Casting candidate ${candidate.name} considered and rejected: ${reason}.`,
          valid: false,
          invalidReason: reason,
          changes,
          rejectedCandidates: rejected,
          unlocksOriginalDeadline: false,
        });
        continue;
      }
      if (!eligible) continue; // unknown eligibility — surfaced, never guessed.
      const changes: RepairChange[] = [{
        kind: 'recast',
        shootBlockId: block.id,
        toActorId: candidate.id,
        roleId: block.roleId,
      }];
      recasts.push({
        id: `pr-${stableId('recast', block.id, candidate.id)}`,
        title: `Cast "${block.label}" to ${candidate.name}`,
        summary: `Cast the open block "${block.label}" (${block.id}) to ${candidate.name} for role ${block.role?.name ?? block.roleId}.`,
        valid: true,
        changes,
        rejectedCandidates: [],
        unlocksOriginalDeadline: false,
      });
    }
  }

  // 4. Approval fact: re-enables the original deadline for double-booked talent.
  const doubleBooked = findings.filter((f) => f.code === 'double_booking');
  if (doubleBooked.length > 0) {
    const actorIds = sortedIds(
      doubleBooked.map((f) => f.evidencePath[3]).filter((id): id is string => id !== undefined && id !== ''),
    );
    const names = actorIds.map((id) => actorsById.get(id)?.name ?? id).join(', ');
    const proposals: Proposal[] = [{
      id: `pr-${stableId('approval', SPLIT_DAY_APPROVAL_FACT)}`,
      title: `Approval: ${SPLIT_DAY_APPROVAL_FACT}`,
      summary: `If the directors approve a split day, ${names} can cover both overlapping blocks without recasting; the original schedule is re-enabled.`,
      valid: true,
      changes: [],
      rejectedCandidates: [],
      unlocksOriginalDeadline: true,
      requiresApprovalFact: SPLIT_DAY_APPROVAL_FACT,
    }];
    return [
      ...clarifications.sort((a, b) => a.id.localeCompare(b.id)),
      ...recasts.sort((a, b) => a.id.localeCompare(b.id)),
      ...rejections.sort((a, b) => a.id.localeCompare(b.id)),
      ...proposals,
    ];
  }

  return [
    ...clarifications.sort((a, b) => a.id.localeCompare(b.id)),
    ...recasts.sort((a, b) => a.id.localeCompare(b.id)),
    ...rejections.sort((a, b) => a.id.localeCompare(b.id)),
  ];
}

/**
 * A double-booked block is a recast target when it loses the tie-break
 * against at least one of its overlapping partners (earlier contract wins).
 */
function isRecastTarget(
  block: BlockView,
  views: BlockView[],
  productionsById: Map<string, Production>,
): boolean {
  const partners = views.filter(
    (v) => v.id !== block.id && v.castActorId === block.castActorId && windowsOverlap(v, block),
  );
  return partners.some((p) => recastLoser(block, p, productionsById).id === block.id);
}

/** Stable 8-hex FNV-1a digest so proposal ids are deterministic across runs. */
export function stableId(...parts: string[]): string {
  const input = parts.join('\u0000');
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Analysis assembler used by the graph layer. */
export function buildAnalysis(workspace: Workspace): Analysis {
  return {
    workspaceRevision: workspace.revision,
    check: checkPlan(workspace),
    proposals: proposeRepairs(workspace),
  };
}

