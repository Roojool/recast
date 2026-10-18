'use client';

import React from 'react';
import type { Workspace, Analysis, Finding } from '@/lib/types';

export interface HeroBottleneckCardProps {
  workspace: Workspace;
  analysis: Analysis | null;
  onNavigateToConflicts: () => void;
  onNavigateToRepairs: () => void;
  onOpenSourceDrawer: () => void;
  onCheckPlan: () => void;
  isChecking: boolean;
}

function overlapLabel(a: { start: string; end: string }, b: { start: string; end: string }): string {
  return `${a.start.slice(0, 10)} → ${a.end.slice(0, 10)} overlaps ${b.start.slice(0, 10)} → ${b.end.slice(0, 10)}`;
}

export function HeroBottleneckCard({
  workspace,
  analysis,
  onNavigateToConflicts,
  onNavigateToRepairs,
  onOpenSourceDrawer,
  onCheckPlan,
  isChecking,
}: HeroBottleneckCardProps) {
  const findings = analysis?.check.findings ?? [];
  const ok = analysis?.check.ok ?? true;
  const critical = findings.filter((f) => f.severity === 'critical');

  const doubleBooking = critical.find((f) => f.code === 'double_booking');
  const stageOvercapacity = critical.find((f) => f.code === 'stage_overcapacity');

  return (
    <section className="paper-card" data-testid="hero-card" style={{ padding: '32px', margin: '0 1rem', borderColor: 'var(--ink)' }}>
      <div className="editorial-label">Hero — Bottleneck</div>
      <h2 className="editorial-headline" style={{ fontSize: '1.7rem', marginBottom: '10px' }}>
        {ok ? 'Plan covers every shoot block' : 'Shoot plan has open findings'}
      </h2>
      <div data-testid="hero-summary" style={{ color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
        {ok
          ? 'All shoot blocks are covered with no double-booking or stage overcapacity.'
          : `${critical.length} open finding${critical.length !== 1 ? 's' : ''} block this shoot plan. ${doubleBooking ? 'Talent is double-booked across overlapping blocks — review the tie-break.' : ''} ${stageOvercapacity ? 'Three scenes compete for one stage — only a pair can share.' : ''}`}
      </div>
      {critical.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {critical.map((f) => (
            <div key={f.id} style={{ padding: '10px 14px', background: 'var(--orange-light)', border: '1px solid var(--orange-border)', borderRadius: '6px', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--clay-700)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.code}</span>
              <p style={{ margin: '4px 0 0', color: 'var(--ink)' }}>{f.message}</p>
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.78rem', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Evidence path: {f.evidencePath.join(' → ')}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={onNavigateToConflicts} className="btn-editorial-primary" style={{ minHeight: '42px', padding: '8px 20px' }}>
          View conflicts
        </button>
        <button type="button" onClick={onNavigateToRepairs} className="btn-editorial-secondary" style={{ minHeight: '42px', padding: '8px 20px' }}>
          Review repairs
        </button>
      </div>
    </section>
  );
}
