'use client';

import React from 'react';
import type { WorkspaceEdit } from '@/lib/types';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetModal({ isOpen, onClose, onConfirm }: ResetModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="editorial-label">Reset workspace</div>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '10px' }}>Start fresh?</h2>
        <p style={{ color: 'var(--ink-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          This creates a brand-new anonymous workspace from the S1 hero fixture. Any unsaved edits will
          be lost. The new workspace is cookie-bound and persisted to FalkorDB.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={onClose} className="btn-editorial-secondary" style={{ minHeight: '42px', padding: '0 20px' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn-editorial-primary" style={{ minHeight: '42px', padding: '0 24px' }}>
            Reset fixture
          </button>
        </div>
      </div>
    </div>
  );
}

export interface EditModalsProps {
  resetModal?: ResetModalProps;
}

export function EditModals({ resetModal }: EditModalsProps) {
  if (!resetModal) return null;
  return <ResetModal {...resetModal} />;
}
