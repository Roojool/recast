'use client';

import React from 'react';
import type { Workspace, Analysis, Proposal, RepairChange } from '@/lib/types';

export interface RepairComparisonViewProps {
  workspace: Workspace;
  analysis: Analysis | null;
  onApproveProposal: (proposalId: string) => void;
  onOpenSourceDrawer: () => void;
  isApproving: boolean;
  onCheckPlan: () => void;
  isChecking: boolean;
}

function changeSummary(c: RepairChange): string {
  switch (c.kind) {
    case 'recast':
      return `Recast ${c.shootBlockId} to actor ${c.toActorId}`;
    case 'reschedule-block':
      return `Reschedule ${c.shootBlockId} for actor ${c.actorId}`;
    case 'clarify-unknown':
      return `Clarify unknown for actor ${c.actorId}`;
  }
}

export function RepairComparisonView({
  workspace,
  analysis,
  onApproveProposal,
  onOpenSourceDrawer,
  isApproving,
  onCheckPlan,
  isChecking,
}: RepairComparisonViewProps) {
  const proposals = analysis?.proposals ?? [];
  const valid = proposals.filter((p) => p.valid);
  const rejected = proposals.filter((p) => !p.valid);

  return (
    <section className="paper-card" data-testid="options-view" style={{ padding: '32px', margin: '0 1rem' }}>
      <div className="editorial-label">Repairs · Plan options</div>
      <h2 className="editorial-headline" style={{ fontSize: '1.7rem', marginBottom: '16px' }}>Repair proposals</h2>
      {valid.length === 0 && rejected.length === 0 ? (
        <p style={{ color: 'var(--ink-secondary)' }}>No repairs needed — the plan is covered.</p>
      ) : (
        <>
          <div className="editorial-label" style={{ marginBottom: '8px', fontSize: '0.8rem' }}>Valid repairs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {valid.map((p) => (
              <div key={p.id} style={{ padding: '14px 16px', border: '1.5px solid var(--ink)', borderRadius: '6px', background: 'var(--forest-light)' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{p.title}</div>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '6px' }}>{p.summary}</p>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--forest-base)', marginBottom: '8px' }}>
                  {p.changes.map(changeSummary).join('; ') || 'Approval fact unlocks original deadline'}
                </div>
                <button
                  type="button"
                  onClick={() => onApproveProposal(p.id)}
                  disabled={isApproving}
                  className="btn-editorial-primary"
                  data-testid={`approve-${p.id}`}
                  style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                >
                  {isApproving ? 'Approving…' : 'Approve repair'}
                </button>
              </div>
            ))}
          </div>

          {rejected.length > 0 && (
            <>
              <div className="editorial-label" style={{ marginBottom: '8px', fontSize: '0.8rem' }}>Rejected candidates</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rejected.map((p) => (
                  <div key={p.id} style={{ padding: '14px 16px', border: '1px solid var(--paper-border-hairline)', borderRadius: '6px', background: 'var(--paper-subtle)' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--clay-700)' }}>{p.title}</div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '6px' }}>{p.summary}</p>
                    {p.invalidReason && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--clay-700)' }}>
                        Reason: {p.invalidReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
