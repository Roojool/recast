'use client';

import React from 'react';
import type { Workspace, Decision } from '@/lib/types';

export interface SavedReceiptsViewProps {
  workspace: Workspace;
  decisions: Decision[];
  onOpenSourceDrawer: () => void;
  onNavigateToOverview: () => void;
}

export function SavedReceiptsView({
  workspace,
  decisions,
  onOpenSourceDrawer,
  onNavigateToOverview,
}: SavedReceiptsViewProps) {
  return (
    <section className="paper-card" data-testid="receipts-view" style={{ padding: '32px', margin: '0 1rem' }}>
      <div className="editorial-label">Receipts · Saved decisions</div>
      <h2 className="editorial-headline" style={{ fontSize: '1.7rem', marginBottom: '16px' }}>Approved repairs</h2>
      <p style={{ color: 'var(--ink-secondary)', marginBottom: '16px' }}>
        Each decision is recorded in FalkorDB with an idempotency key — replaying the same key returns
        the same decision and bumps the workspace revision exactly once.
      </p>
      {decisions.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)' }}>
          No approved repairs yet. Go to Plan options and approve a valid repair.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {decisions.map((d) => (
            <div key={d.id} style={{ padding: '14px 16px', border: '1.5px solid var(--ink)', borderRadius: '6px', background: 'var(--paper-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700 }}>Proposal {d.proposalId}</span>
                <span className="badge-status deterministic" style={{ fontSize: '0.7rem' }}>Recorded</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-tertiary)' }}>
                Decision {d.id} &nbsp;·&nbsp; Workspace revision {d.workspaceRevisionAfter} &nbsp;·&nbsp; {d.approvedAt.slice(0, 16)}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: '20px' }}>
        <button type="button" onClick={onNavigateToOverview} className="btn-editorial-secondary" style={{ minHeight: '42px' }}>
          Back to overview
        </button>
      </div>
    </section>
  );
}
