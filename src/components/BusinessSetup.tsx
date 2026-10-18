'use client';

import React from 'react';
import type { Workspace } from '@/lib/types';

export function BusinessSetup({
  aiAvailable,
  onSample,
  onCreated,
}: {
  aiAvailable: boolean;
  onSample: () => void;
  onCreated: (created: Workspace) => void;
}) {
  return (
    <section className="pact-content-container">
      <div className="wrap">
        <div className="paper-card" style={{ padding: '48px 64px', maxWidth: 720, margin: '0 auto' }}>
          <div className="editorial-label">Recast · New workspace</div>
          <h1 className="editorial-headline" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Open your casting desk</h1>
          <p style={{ color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
            Start from the S1 hero fixture (Vera double-booked across Harbor Grey and Late Amber),
            S2 (green-screen stage triple overlap), or S3 (unknown SAG availability). Each workspace is
            anonymous, cookie-bound, and replayable on FalkorDB.
          </p>
          <button type="button" onClick={onSample} className="btn-editorial-primary" style={{ padding: '10px 24px', minHeight: '48px' }}>
            Load S1 hero scenario
          </button>
          <p style={{ color: 'var(--ink-tertiary)', fontSize: '0.85rem', marginTop: '16px' }}>
            All data is fictional. Graph state lives in FalkorDB; there is no in-memory substitute.
          </p>
        </div>
      </div>
    </section>
  );
}
