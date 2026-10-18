'use client';

import React from 'react';

export function SkeletonLoader() {
  return (
    <div className="paper-card" style={{ padding: '48px 64px', maxWidth: 720, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="editorial-label">Loading casting desk</div>
      <div style={{ height: '32px', background: 'var(--paper-subtle)', borderRadius: '4px', width: '60%' }}></div>
      <div style={{ height: '20px', background: 'var(--paper-subtle)', borderRadius: '4px', width: '80%' }}></div>
      <div style={{ height: '20px', background: 'var(--paper-subtle)', borderRadius: '4px', width: '45%' }}></div>
      <div style={{ height: '20px', background: 'var(--paper-subtle)', borderRadius: '4px', width: '70%' }}></div>
      <div style={{ height: '120px', background: 'var(--paper-subtle)', borderRadius: '6px', width: '100%' }}></div>
    </div>
  );
}
