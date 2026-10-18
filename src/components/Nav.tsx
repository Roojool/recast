'use client';

import React from 'react';
import {
  LayoutDashboard,
  Layers,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { Workspace, Analysis } from '@/lib/types';

export type NavView = 'dashboard' | 'overview' | 'conflicts' | 'repairs' | 'receipts' | 'memory';

interface NavProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  workspace: Workspace | null;
  analysis: Analysis | null;
  onOpenSourceDrawer: () => void;
}

export const VIEW_LABELS = {
  dashboard: 'Desk',
  overview: 'Shoot blocks',
  conflicts: 'Needs attention',
  repairs: 'Plan options',
  receipts: 'Saved decisions',
  memory: 'Ask Recast',
} as const;

function findingCount(analysis: Analysis | null): number {
  return analysis?.check?.findings?.filter((f) => f.severity === 'critical').length ?? 0;
}

export function Nav({
  currentView,
  onSelectView,
  workspace,
  analysis,
  onOpenSourceDrawer,
}: NavProps) {
  const checkResult = analysis?.check ?? null;
  const criticalCount = findingCount(analysis);
  const proposalCount = analysis?.proposals?.length ?? 0;
  const decisionCount = 0;

  const navItems: { id: NavView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: VIEW_LABELS.dashboard, icon: <LayoutDashboard size={15} /> },
    {
      id: 'overview',
      label: VIEW_LABELS.overview,
      icon: <Layers size={15} />,
      badge: workspace?.shootBlocks.length,
    },
    {
      id: 'conflicts',
      label: VIEW_LABELS.conflicts,
      icon: <AlertTriangle size={15} />,
      badge: criticalCount > 0 ? criticalCount : undefined,
      badgeColor: criticalCount > 0 ? 'var(--clay-600)' : undefined,
    },
    {
      id: 'repairs',
      label: VIEW_LABELS.repairs,
      icon: <ArrowRightLeft size={15} />,
      badge: proposalCount > 0 ? proposalCount : undefined,
      badgeColor: proposalCount > 0 ? 'var(--forest-base)' : undefined,
    },
    {
      id: 'receipts',
      label: VIEW_LABELS.receipts,
      icon: <CheckCircle2 size={15} />,
      badge: decisionCount,
    },
    {
      id: 'memory',
      label: VIEW_LABELS.memory,
      icon: <MessageSquare size={15} />,
    },
  ];

  return (
    <nav className="pact-nav-rail" aria-label="Recast casting desk navigation" data-testid="nav-rail">
      {/* Brand Mark */}
      <div className="pact-nav-brand">
        <div
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'var(--ink-primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            fontSize: '0.98rem',
            fontWeight: 700,
            borderRadius: 'var(--radius-xs)',
            flexShrink: 0,
          }}
        >
          RC
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: '0.92rem',
              letterSpacing: '0.06em',
              color: 'var(--ink-primary)',
            }}
          >
            Recast
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              color: 'var(--ink-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            Casting Continuity Desk
          </span>
        </div>
      </div>

      {/* Horizontal Navigation Links */}
      <div className="pact-nav-items">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                if (typeof window !== 'undefined') {
                  window.scrollTo(0, 0);
                }
              }}
              className={`nav-item-btn ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`nav-${item.id}`}
              data-view={item.id}
            >
              <span
                style={{
                  color: isActive ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                  display: 'inline-flex',
                }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <b
                  className="nav-count-badge"
                  style={{
                    backgroundColor: item.badgeColor ?? 'var(--ink-primary)',
                    color: '#FFFFFF',
                  }}
                >
                  {item.badge}
                </b>
              )}
            </button>
          );
        })}
      </div>

      {/* Sources Launcher */}
      <div className="pact-nav-footer">
        <button
          type="button"
          onClick={onOpenSourceDrawer}
          className="btn-editorial-secondary"
          data-testid="open-sources"
          style={{
            fontSize: '0.78rem',
            padding: '6px 12px',
            minHeight: '36px',
          }}
        >
          <FileText size={13} style={{ color: 'var(--forest-base)', flexShrink: 0 }} />
          <span>Sources</span>
          <span
            className="font-mono"
            style={{
              marginLeft: '4px',
              fontSize: '0.68rem',
              backgroundColor: 'var(--paper-subtle)',
              border: '1px solid var(--paper-border)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-xs)',
              fontWeight: 600,
            }}
          >
            {0}
          </span>
        </button>
      </div>
    </nav>
  );
}
