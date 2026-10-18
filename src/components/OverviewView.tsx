'use client';

import React from 'react';
import type { Workspace, Analysis } from '@/lib/types';

export interface OverviewViewProps {
  workspace: Workspace;
  analysis: Analysis | null;
  onEditWorkspace: (edit: Parameters<typeof import('@/lib/graph').editWorkspace>[2]) => void;
  onOpenSourceDrawer: () => void;
}

export function OverviewView({
  workspace,
  analysis,
  onEditWorkspace,
  onOpenSourceDrawer,
}: OverviewViewProps) {
  const findings = analysis?.check.findings ?? [];
  const critical = findings.filter((f) => f.severity === 'critical');

  return (
    <section className="paper-card" style={{ padding: '32px', margin: '0 1rem' }}>
      <div className="editorial-label">Overview · Shoot blocks</div>
      <h2 className="editorial-headline" style={{ fontSize: '1.7rem', marginBottom: '16px' }}>Shoot blocks &amp; casting</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--ink)' }}>
              <th style={{ padding: '10px', color: 'var(--ink-tertiary)', fontWeight: 600 }}>Block</th>
              <th style={{ padding: '10px', color: 'var(--ink-tertiary)', fontWeight: 600 }}>Production</th>
              <th style={{ padding: '10px', color: 'var(--ink-tertiary)', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '10px', color: 'var(--ink-tertiary)', fontWeight: 600 }}>Cast actor</th>
              <th style={{ padding: '10px', color: 'var(--ink-tertiary)', fontWeight: 600 }}>Window</th>
              <th style={{ padding: '10px', color: 'var(--ink-tertiary)', fontWeight: 600 }}>Critical</th>
            </tr>
          </thead>
          <tbody>
            {workspace?.shootBlocks.map((sb) => {
              const production = workspace.productions.find((p) => p.id === sb.productionId);
              const role = workspace.roles.find((r) => r.id === sb.roleId);
              const actor = sb.castActorId ? workspace.actors.find((a) => a.id === sb.castActorId) : null;
              return (
                <tr key={sb.id} style={{ borderBottom: '1px solid var(--paper-border-hairline)' }}>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{sb.label}</td>
                  <td style={{ padding: '10px' }}>{production?.title ?? sb.productionId}</td>
                  <td style={{ padding: '10px' }}>{role?.name ?? sb.roleId}</td>
                  <td style={{ padding: '10px' }}>{actor ? actor.name : 'Unassigned'}</td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{sb.start.slice(0, 10)} → {sb.end.slice(0, 10)}</td>
                  <td style={{ padding: '10px' }}>{sb.continuityCritical ? 'Yes' : 'No'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {critical.length > 0 && (
        <div style={{ marginTop: '20px', padding: '14px 16px', background: 'var(--orange-light)', border: '1px solid var(--orange-border)', borderRadius: '6px' }}>
          <span style={{ color: 'var(--clay-700)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Critical findings</span>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px', color: 'var(--ink)' }}>
            {critical.map((f) => (
              <li key={f.id} style={{ marginBottom: '4px', fontSize: '0.9rem' }}>{f.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
