'use client';

import React, { useState } from 'react';
import type { Workspace, AgentReply } from '@/lib/types';

export interface StudioMemoryViewProps {
  workspace: Workspace;
  replies: AgentReply[];
  onSendMessage: (message: string) => void;
  onOpenSourceDrawer: () => void;
  isSending: boolean;
  isLiveAiEnabled: boolean;
  isLiveCapable: boolean;
}

export function StudioMemoryView({
  workspace,
  replies,
  onSendMessage,
  onOpenSourceDrawer,
  isSending,
  isLiveAiEnabled,
  isLiveCapable,
}: StudioMemoryViewProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage('');
  };

  return (
    <section className="paper-card" data-testid="memory-view" style={{ padding: '32px', margin: '0 1rem' }}>
      <div className="editorial-label">Memory · Agent Q&amp;A</div>
      <h2 className="editorial-headline" style={{ fontSize: '1.7rem', marginBottom: '16px' }}>Ask Recast</h2>
      <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
        Ask about any actor, block, or role in the current plan (e.g. “Tell me about Vera and block-b-7”).
        Replies are deterministic and drawn from the graph — never guessed.
      </div>
      <div style={{ marginBottom: '16px' }}>
        {replies.length > 0 && (
          <div style={{ borderTop: '1px solid var(--paper-border-hairline)', paddingTop: '12px' }}>
            {replies.map((r, i) => (
              <div key={i} style={{ marginBottom: '12px', padding: '12px 16px', background: 'var(--paper-surface)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--ink-tertiary)', marginBottom: '6px' }}>
                  <span>You</span>
                  <span className={`badge-status ${r.mode}`} style={{ fontSize: '0.68rem' }}>{r.mode}</span>
                </div>
                <p style={{ margin: '0 0 4px', color: 'var(--ink)' }}>{r.text}</p>
                {r.warning && <span style={{ fontSize: '0.78rem', color: 'var(--clay-700)', fontStyle: 'italic' }}>{r.warning}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', maxWidth: 600 }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about Vera, block-b-7, Mina, Cole…"
          className="editorial-input"
          disabled={isSending}
        />
        <button type="submit" disabled={isSending || !message.trim()} className="btn-editorial-primary" style={{ minHeight: '44px', padding: '0 20px' }}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {!isLiveCapable && (
        <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--ink-tertiary)' }}>
          Live AI overlay not available — deterministic replies only.
        </p>
      )}
    </section>
  );
}
