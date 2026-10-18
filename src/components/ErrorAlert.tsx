'use client';

import React from 'react';

interface ErrorAlertProps {
  error: { message: string; code?: string } | null;
  onDismiss: () => void;
  onRetry: () => void;
  onRecheck: () => void;
}

export function ErrorAlert({ error, onDismiss, onRetry, onRecheck }: ErrorAlertProps) {
  if (!error) return null;
  const isServiceUnavailable = error.code === 'SERVICE_UNAVAILABLE' || error.code === '503';
  const isConflict = error.code === 'REVISION_CONFLICT' || error.code === '409';

  return (
    <div className="paper-card" style={{ borderColor: 'var(--red)', margin: '0 1rem 1.5rem 1rem', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ color: 'var(--red)', fontWeight: 700 }}>{isServiceUnavailable ? 'Service unavailable' : isConflict ? 'Plan changed' : 'Error'}</span>
      </div>
      <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '12px' }}>{error.message}</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {isServiceUnavailable && (
          <button type="button" onClick={onRetry} className="btn-editorial-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
            Try again
          </button>
        )}
        {isConflict && (
          <button type="button" onClick={onRecheck} className="btn-editorial-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
            Recheck plan
          </button>
        )}
        <button type="button" onClick={onDismiss} className="btn-editorial-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
