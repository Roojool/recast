'use client';

import React from 'react';
import type { Workspace, Analysis, Finding } from '@/lib/types';

export interface ConflictEvidenceViewProps {
  workspace: Workspace;
  analysis: Analysis | null;
  onOpenSourceDrawer: () => void;
  onNavigateToRepairs: () => void;
  onCheckPlan: () => void;
  isChecking: boolean;
}

export function ConflictEvidenceView({
  workspace,
  analysis,
  onOpenSourceDrawer,
  onNavigateToRepairs,
  onCheckPlan,
  isChecking,
}: ConflictEvidenceViewProps) {
  const findings = analysis?.check.findings ?? [];
  const critical = findings.filter((f) => f.severity === 'critical');

  return (
    <section className="paper-card" data-testid="conflict-view" style={{ padding: '32px', margin: '0 1rem' }}>
      <div className="editorial-label">Conflicts · Evidence</div>
      <h2 className="editorial-headline" style={{ fontSize: '1.7rem', marginBottom: '16px' }}>Conflict evidence</h2>
      {critical.length === 0 ? (
        <p style={{ color: 'var(--ink-secondary)' }}>No critical findings. Every shoot block is covered.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {critical.map((f) => (
            <div key={f.id} style={{ padding: '16px', border: '1.5px solid var(--ink)', borderRadius: '6px', background: 'var(--paper-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.code}</span>
                <span className="badge-status infeasible" style={{ fontSize: '0.7rem' }}>Critical</span>
              </div>
              <p style={{ color: 'var(--ink)', lineHeight: 1.5, marginBottom: '8px' }}>{f.message}</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--ink-tertiary)', background: 'var(--paper)', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--paper-border-hairline)' }}>
                Evidence path: {f.evidencePath.map((id, i) => (i > 0 ? ' → ' : '') + id).join('')}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <button type="button" onClick={onNavigateToRepairs} className="btn-editorial-primary" style={{ minHeight: '42px' }}>
          Review repairs
        </button>
        <button type="button" onClick={onCheckPlan} disabled={isChecking} className="btn-editorial-secondary" style={{ minHeight: '42px' }}>
          {isChecking ? 'Checking…' : 'Recheck plan'}
        </button>
      </div>
    </section>
  );
}
