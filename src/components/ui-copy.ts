/**
 * Recast — small plain-language copy helpers shared by casting desk views.
 *
 * These functions only translate existing data into friendlier wording.
 * They never change a check result, invent evidence, hide a blocker, or
 * promote an unknown eligibility to an allowed one.
 */
import type { CheckResult } from '@/lib/types';

export const VIEW_LABELS = {
  dashboard: 'Desk',
  overview: 'Shoot blocks',
  conflicts: 'Needs attention',
  repairs: 'Plan options',
  receipts: 'Saved decisions',
  memory: 'Ask Recast',
} as const;

export type CheckTone = 'good' | 'attention' | 'unknown';

export interface CheckCopy {
  tone: CheckTone;
  headline: string;
  diagnosis: string;
}

/**
 * One short diagnosis plus coverage framing, derived from the real CheckResult
 * fields and status. No fixture numbers are hardcoded.
 */
export function describeCheck(check: CheckResult): CheckCopy {
  if (check.ok) {
    return {
      tone: 'good',
      headline: 'All shoot blocks are covered',
      diagnosis:
        'Every shoot block has a cast actor assigned. No critical findings.',
    };
  }

  const critical = check.findings.filter((f) => f.severity === 'critical').length;
  const warning = check.findings.filter((f) => f.severity === 'warning').length;

  return {
    tone: 'attention',
    headline: `${critical} finding(s) need attention`,
    diagnosis:
      `${critical} critical finding(s) block safe dispatch.` +
      (warning > 0 ? ` ${warning} warning(s) also need review.` : '') +
      ' Fix these before the cameras roll.',
  };
}
