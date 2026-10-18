'use client';

import React from 'react';

export interface SourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: { id: string; title: string; summary: string }[];
  activeSourceId: string | null;
  onSelectSource: (id: string) => void;
}

export function SourceDrawer({
  isOpen,
  onClose,
  sources,
  activeSourceId,
  onSelectSource,
}: SourceDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="editorial-drawer" aria-label="Sources drawer">
      <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="editorial-label">Sources</div>
        <button type="button" onClick={onClose} className="pill" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
          Close
        </button>
      </div>
      <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
        {sources.length === 0 ? (
          <p style={{ color: 'var(--ink-secondary)' }}>No document sources for this domain — all evidence is graph-derived (production → role → shoot block → cast actor → look test / continuity note).</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSource(s.id)}
                className={activeSourceId === s.id ? 'btn-editorial-primary' : 'btn-editorial-secondary'}
                style={{ textAlign: 'left', padding: '10px 16px', fontSize: '0.9rem' }}
              >
                <div style={{ fontWeight: 700 }}>{s.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginTop: '2px' }}>{s.summary}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
