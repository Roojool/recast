'use client';

import React from 'react';
import type { Workspace, Analysis } from '@/lib/types';

export interface HeaderProps {
  workspace: Workspace;
  analysis: Analysis | null;
  health: { ok?: boolean; liveAvailable?: boolean; [key: string]: unknown } | null;
  isLiveAiEnabled: boolean;
  onToggleLiveAi: (v: boolean) => void;
  onAnalyze: () => void;
  onResetClick: () => void;
  isAnalyzing: boolean;
}

export function Header({
  workspace,
  analysis,
  health,
  isLiveAiEnabled,
  onToggleLiveAi,
  onAnalyze,
  onResetClick,
  isAnalyzing,
}: HeaderProps) {
  const findings = analysis?.check.findings ?? [];
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const liveCapable = Boolean(health?.liveAvailable || health?.liveAiAvailable);

  return (
    <header className="pact-masthead" data-testid="masthead">
      <div className="masthead-identity">
        <a href="/" className="masthead-logo" aria-label="Recast home">
          <span className="ic" aria-hidden="true"></span>
          <span className="d" style={{ fontSize: '1.6rem' }}>Recast</span>
        </a>
        <span className="masthead-subtitle">Casting continuity studio</span>
      </div>
      <div className="masthead-controls">
        <div className="masthead-status-desktop">
          <span className="badge-status" data-testid="badge-falkordb">
            {health?.ok === true ? 'FalkorDB connected' : 'FalkorDB unreachable'}
          </span>
          <span className="badge-status" data-testid="badge-agent-mode">
            {liveCapable && isLiveAiEnabled ? 'Live AI ready' : 'Deterministic'}
          </span>
        </div>
        <label className="toggle-switch" style={{ marginLeft: '8px' }}>
          <input
            type="checkbox"
            checked={isLiveAiEnabled && liveCapable}
            onChange={(e) => onToggleLiveAi(e.target.checked && liveCapable)}
            disabled={!liveCapable}
            aria-label="Live AI overlay"
          />
          <span className="toggle-slider" aria-hidden="true"></span>
        </label>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="btn-editorial-primary"
          data-testid="hero-check-plan"
          style={{ marginLeft: '10px', minHeight: '40px' }}
        >
          {isAnalyzing ? 'Checking…' : 'Check plan'}
        </button>
        <button type="button" onClick={onResetClick} className="btn-editorial-secondary" style={{ marginLeft: '8px', minHeight: '40px' }}>
          Reset fixture
        </button>
      </div>
    </header>
  );
}

export function Nav({
  currentView,
  onSelectView,
  workspace,
  analysis,
  onOpenSourceDrawer,
}: {
  currentView: string;
  onSelectView: (v: string) => void;
  workspace: Workspace | null;
  analysis: Analysis | null;
  onOpenSourceDrawer: () => void;
}) {
  const criticalCount = analysis?.check.findings.filter((f) => f.severity === 'critical').length ?? 0;
  const items = [
    { key: 'dashboard', label: 'Desk', count: undefined },
    { key: 'overview', label: 'Shoot blocks', count: workspace?.shootBlocks.length },
    { key: 'conflicts', label: 'Conflicts', count: criticalCount > 0 ? criticalCount : undefined },
    { key: 'repairs', label: 'Plan options', count: analysis?.proposals.filter((p) => p.valid).length ?? undefined },
    { key: 'receipts', label: 'Saved decisions', count: undefined },
    { key: 'memory', label: 'Ask Recast', count: undefined },
  ];

  return (
    <nav className="pact-nav-rail" aria-label="Main navigation">
      <div className="pact-nav-items">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item-btn ${currentView === item.key ? 'active' : ''}`}
            onClick={() => onSelectView(item.key)}
            data-testid={`nav-${item.key}`}
          >
            {item.label}
            {item.count !== undefined && <span className="nav-count-badge">{item.count}</span>}
          </button>
        ))}
      </div>
      <div className="pact-nav-footer">
        <button type="button" className="pill" onClick={onOpenSourceDrawer} style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', borderColor: 'transparent' }}>
          Sources
        </button>
      </div>
    </nav>
  );
}
