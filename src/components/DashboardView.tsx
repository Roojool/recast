'use client';

import React from 'react';
import type { Workspace, Analysis } from '@/lib/types';

export interface DashboardViewProps {
  workspace: Workspace;
  analysis: Analysis | null;
  onNavigate: (view: string) => void;
  onOpenSource: () => void;
  onEditWorkspace: (edit: Parameters<typeof import('@/lib/graph').editWorkspace>[2]) => void;
  onCheck: () => void;
  isChecking: boolean;
}

export function DashboardView({
  workspace,
  analysis,
  onNavigate,
  onOpenSource,
  onEditWorkspace,
  onCheck,
  isChecking,
}: DashboardViewProps) {
  const findings = analysis?.check.findings ?? [];
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;

  return (
    <section className="paper-card" style={{ padding: '32px', margin: '0 1rem' }}>
      <div className="editorial-label">Desk · {workspace?.scenario}</div>
      <h2 className="editorial-headline" style={{ fontSize: '1.8rem', marginBottom: '16px' }}>Shoot plan at a glance</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-label">Shoot blocks</span>
          <span className="stat-value">{workspace?.shootBlocks.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Critical findings</span>
          <span className="stat-value" style={{ color: criticalCount > 0 ? 'var(--red)' : 'var(--forest-base)' }}>{criticalCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Warnings</span>
          <span className="stat-value">{warningCount}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={onCheck} disabled={isChecking} className="btn-editorial-secondary" style={{ minHeight: '42px' }}>
          {isChecking ? 'Checking…' : 'Re-run plan check'}
        </button>
        <button type="button" onClick={() => onNavigate('conflicts')} className="btn-editorial-secondary" style={{ minHeight: '42px' }}>
          Review conflicts
        </button>
        <button type="button" onClick={() => onNavigate('repairs')} className="btn-editorial-secondary" style={{ minHeight: '42px' }}>
          Review repairs
        </button>
      </div>
    </section>
  );
}
